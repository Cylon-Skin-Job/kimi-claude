import { useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { toolNameToSegmentType } from '../lib/instructions';
import { SEGMENT_ICONS } from '../lib/instructions';
import { setLoggerWs, captureConsoleLogs } from '../lib/logger';
import { loadRootTree } from './useFileTree';
import { showToast } from '../components/Toast';
import type { WebSocketMessage, WorkspaceId, ExchangeData, AssistantPart, Message, StreamSegment } from '../types';

const WS_URL = 'ws://localhost:3001';

/**
 * Convert rich exchanges (from history.json) to messages with segments
 */
function convertExchangesToMessages(
  workspace: WorkspaceId,
  exchanges: ExchangeData[],
  addMessage: (workspace: WorkspaceId, message: Message) => void
) {
  exchanges.forEach((exchange, idx) => {
    // Add user message
    addMessage(workspace, {
      id: `ex-${idx}-user`,
      type: 'user',
      content: exchange.user,
      timestamp: exchange.ts,
    });

    // Build segments from assistant parts
    const segments = exchange.assistant.parts.map((part) => convertPartToSegment(part));

    // Add assistant message with segments
    const assistantContent = exchange.assistant.parts
      .filter((p): p is {type: 'text', content: string} => p.type === 'text')
      .map(p => p.content)
      .join('');

    addMessage(workspace, {
      id: `ex-${idx}-assistant`,
      type: 'assistant',
      content: assistantContent,
      timestamp: exchange.ts,
      segments: segments.length > 0 ? segments : undefined,
    });
  });
}

/**
 * Convert a single assistant part to a stream segment
 */
function convertPartToSegment(part: AssistantPart): StreamSegment {
  if (part.type === 'text') {
    return {
      type: 'text',
      content: part.content,
    };
  } else if (part.type === 'think') {
    return {
      type: 'think',
      content: part.content,
    };
  } else {
    // Tool call part
    const segType = toolNameToSegmentType(part.name);
    const info = SEGMENT_ICONS[segType];
    return {
      type: segType,
      content: part.result.output || '',
      toolCallId: part.toolCallId,
      icon: info?.icon,
      toolArgs: part.arguments,
      toolDisplay: part.result.display,
      isError: !!part.result.error,
    };
  }
}

/**
 * Convert legacy history format to messages
 */
function convertHistoryToMessages(
  workspace: WorkspaceId,
  history: { role: 'user' | 'assistant'; content: string; hasToolCalls?: boolean }[],
  addMessage: (workspace: WorkspaceId, message: Message) => void
) {
  history.forEach((h, idx) => {
    addMessage(workspace, {
      id: `hist-${idx}`,
      type: h.role,
      content: h.content,
      timestamp: Date.now() - (history.length - idx) * 1000,
    });
  });
}

export function useWebSocket() {
  const setWs = useWorkspaceStore((state) => state.setWs);
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const setContextUsage = useWorkspaceStore((state) => state.setContextUsage);
  const appendSegment = useWorkspaceStore((state) => state.appendSegment);
  const pushSegment = useWorkspaceStore((state) => state.pushSegment);
  const updateSegmentByToolCallId = useWorkspaceStore((state) => state.updateSegmentByToolCallId);
  const resetSegments = useWorkspaceStore((state) => state.resetSegments);
  const setPendingTurnEnd = useWorkspaceStore((state) => state.setPendingTurnEnd);
  const setCurrentTurn = useWorkspaceStore((state) => state.setCurrentTurn);
  const addMessage = useWorkspaceStore((state) => state.addMessage);
  const updateTurnContent = useWorkspaceStore((state) => state.updateTurnContent);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      console.log('[WS] Connecting...');
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('[WS] Connected');
        setWs(socket);
        setLoggerWs(socket);
        captureConsoleLogs();
        socket.send(JSON.stringify({ type: 'initialize' }));
      };

      socket.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      socket.onclose = () => {
        console.log('[WS] Disconnected');
        setWs(null);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    const workspace: WorkspaceId = currentWorkspace;

    switch (msg.type) {
      case 'connected':
        console.log('[WS] Session:', msg.sessionId);
        break;

      case 'turn_begin': {
        console.log('[WS] Turn begin');
        const wsState = useWorkspaceStore.getState().workspaces[workspace];
        const prevTurn = wsState.currentTurn;
        const segments = wsState.segments;

        if (prevTurn) {
          addMessage(workspace, {
            id: prevTurn.id,
            type: 'assistant',
            content: prevTurn.content,
            timestamp: Date.now(),
            segments: segments.length > 0 ? [...segments] : undefined,
          });
        }

        resetSegments(workspace);

        setCurrentTurn(workspace, {
          id: msg.turnId || '',
          content: '',
          status: 'streaming',
          hasThinking: false,
          thinkingContent: ''
        });

        break;
      }

      case 'content':
        if (msg.text) {
          // Segment store for MessageList
          appendSegment(workspace, 'text', msg.text);

          const turn = useWorkspaceStore.getState().workspaces[workspace].currentTurn;
          if (turn) {
            updateTurnContent(workspace, turn.content + msg.text);
          }
        }
        break;

      case 'thinking':
        if (msg.text) {
          // Segment store for MessageList
          appendSegment(workspace, 'think', msg.text);
        }
        break;

      case 'tool_call': {
        const segType = toolNameToSegmentType(msg.toolName || '');

        // Segment store for MessageList
        pushSegment(workspace, {
          type: segType,
          content: '',
          toolCallId: msg.toolCallId,
        });

        break;
      }

      case 'tool_result': {
        // Segment store for MessageList
        const segments = useWorkspaceStore.getState().workspaces[workspace].segments;
        const toolSeg = segments.filter((s) => s.toolCallId === msg.toolCallId).pop();

        if (toolSeg && msg.toolCallId) {
          updateSegmentByToolCallId(workspace, msg.toolCallId, {
            content: msg.toolOutput || '',
            toolArgs: msg.toolArgs,
            toolDisplay: msg.toolDisplay,
            isError: msg.isError,
          });
        }

        break;
      }

      case 'turn_end': {
        const currentTurn = useWorkspaceStore.getState().workspaces[workspace].currentTurn;

        if (currentTurn) {
          setPendingTurnEnd(workspace, true);
        }

        break;
      }

      case 'status_update':
        if (msg.contextUsage !== undefined) {
          setContextUsage(msg.contextUsage);
        }
        break;

      case 'request':
        console.log('[WS] Agent request:', msg.requestType);
        break;

      case 'auth_error':
        showToast(msg.message || 'Authentication failed. Run `kimi login` in your terminal.');
        break;

      case 'error':
        console.error('[WS] Wire error:', msg.error);
        break;

      // Thread management messages
      case 'thread:list':
        console.log('[WS] thread:list received:', msg.threads?.length, 'threads');
        if (msg.threads) {
          useWorkspaceStore.getState().setThreads(msg.threads);
        }
        break;

      case 'thread:created':
        console.log('[WS] thread:created received:', msg.threadId, msg.thread);
        if (msg.thread && msg.threadId) {
          useWorkspaceStore.getState().addThread({ threadId: msg.threadId, entry: msg.thread });
          useWorkspaceStore.getState().setCurrentThreadId(msg.threadId);
          // Clear messages for new thread
          useWorkspaceStore.getState().clearWorkspace(workspace);
          // Refresh file tree to show new thread folder
          loadRootTree();
        } else {
          console.error('[WS] thread:created missing data:', msg);
        }
        break;

      case 'thread:opened':
        console.log('[WS] thread:opened:', msg.threadId?.slice(0,8), 'exchanges:', msg.exchanges?.length, 'history:', msg.history?.length);
        if (msg.threadId && msg.thread) {
          useWorkspaceStore.getState().setCurrentThreadId(msg.threadId);
          // Clear current messages and load history if provided
          useWorkspaceStore.getState().clearWorkspace(workspace);

          // Use rich format (exchanges) if available, fallback to legacy history
          if (msg.exchanges && msg.exchanges.length > 0) {
            console.log('[WS] Loading', msg.exchanges.length, 'exchanges (rich format)');
            convertExchangesToMessages(workspace, msg.exchanges, addMessage);
          } else if (msg.history && msg.history.length > 0) {
            console.log('[WS] Loading', msg.history.length, 'messages (legacy format)');
            convertHistoryToMessages(workspace, msg.history, addMessage);
          }
        }
        break;

      case 'thread:renamed':
        if (msg.threadId && msg.name) {
          useWorkspaceStore.getState().updateThread(msg.threadId, { name: msg.name });
        }
        break;

      case 'thread:deleted':
        if (msg.threadId) {
          useWorkspaceStore.getState().removeThread(msg.threadId);
        }
        break;

      case 'message:sent':
        // Message was saved to thread, could trigger thread list refresh
        console.log('[WS] Message saved to thread');
        break;

      default:
        break;
    }
  }, [currentWorkspace]);

  const currentThreadId = useWorkspaceStore((state) => state.currentThreadId);

  const sendMessage = useCallback((text: string, workspace?: WorkspaceId) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'prompt',
        user_input: text,
        workspace: workspace || currentWorkspace,
        threadId: currentThreadId
      }));
    }
  }, [currentWorkspace, currentThreadId]);

  return { ws: socketRef.current, sendMessage };
}
