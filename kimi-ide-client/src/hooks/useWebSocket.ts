import { useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { getQueue } from '../lib/blockQueue';
import { toolNameToSegmentType, toolLabel } from '../lib/instructions';
import type { WebSocketMessage, WorkspaceId } from '../types';

const WS_URL = 'ws://localhost:3001';

export function useWebSocket() {
  const setWs = useWorkspaceStore((state) => state.setWs);
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const setContextUsage = useWorkspaceStore((state) => state.setContextUsage);
  const queueMessage = useWorkspaceStore((state) => state.queueMessage);
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
    const queue = getQueue(workspace);
    
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

        // Start block queue for this turn
        queue.startTurn();
        break;
      }
        
      case 'content':
        console.log('[WS] Content received:', msg.text?.slice(0, 50));
        if (msg.text) {
          appendSegment(workspace, 'text', msg.text);
          
          const turn = useWorkspaceStore.getState().workspaces[workspace].currentTurn;
          if (turn) {
            updateTurnContent(workspace, turn.content + msg.text);
          }

          // Add to block queue
          queue.addBlock({
            type: 'text',
            content: msg.text,
            isComplete: false,
          });
        }
        break;
        
      case 'thinking':
        console.log('[WS] Thinking received:', msg.text?.slice(0, 50));
        if (msg.text) {
          appendSegment(workspace, 'think', msg.text);
          
          // Add think block to queue
          queue.addBlock({
            type: 'think',
            content: msg.text,
            header: {
              icon: 'lightbulb',
              label: 'Thinking',
            },
            isComplete: false,
          });
        }
        break;

      case 'tool_call': {
        const segType = toolNameToSegmentType(msg.toolName || '');
        
        pushSegment(workspace, {
          type: segType,
          content: '',
          toolCallId: msg.toolCallId,
        });

        // Add tool block to queue
        queue.addBlock({
          type: 'tool',
          content: msg.toolName || '',
          header: {
            icon: segType === 'read' ? 'search' : 'build',
            label: msg.toolName || 'Tool',
          },
          isComplete: false,
        });
        break;
      }

      case 'tool_result': {
        const segments = useWorkspaceStore.getState().workspaces[workspace].segments;
        const toolSeg = segments.filter((s) => s.toolCallId === msg.toolCallId).pop();

        if (toolSeg && msg.toolCallId) {
          const segType = toolSeg.type;
          const label = toolLabel(segType, msg.toolArgs);
          
          updateSegmentByToolCallId(workspace, msg.toolCallId, {
            content: msg.toolOutput || '',
            label,
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
        
        // End block queue
        queue.endTurn();
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
        
      default: {
        const phase = useWorkspaceStore.getState().workspaces[workspace].renderPhase;
        if (phase !== 'streaming' && phase !== 'idle') {
          queueMessage(workspace, msg);
        }
      }
    }
  }, [currentWorkspace]);
  
  const sendMessage = useCallback((text: string, workspace?: WorkspaceId) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'prompt',
        user_input: text,
        workspace: workspace || currentWorkspace
      }));
    }
  }, [currentWorkspace]);
  
  return { ws: socketRef.current, sendMessage };
}
