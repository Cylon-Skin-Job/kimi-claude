/**
 * @module ws-client
 * @role Standalone WebSocket client — no React dependency
 *
 * Manages connection, reconnection, discovery, and message routing.
 * Writes directly to the Zustand store. React components read from the store only.
 */

import { usePanelStore } from '../state/panelStore';
import { toolNameToSegmentType, SEGMENT_ICONS } from '../lib/instructions';
import { isGroupable, getSummaryField } from '../lib/segmentCatalog';
import { setLoggerWs, captureConsoleLogs } from '../lib/logger';
import { loadRootTree } from '../lib/file-tree';
import { showToast } from '../lib/toast';
import { loadAllPanels } from '../lib/panels';
import type { WebSocketMessage, ExchangeData, AssistantPart, StreamSegment, SegmentType } from '../types';

// --- Types ---

interface GroupState {
  type: SegmentType;
  segmentIndex: number;
  toolCallIds: Set<string>;
  count: number;
}

// --- Module state ---

const WS_URL = 'ws://localhost:3001';

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let group: GroupState | null = null;

// --- Public API ---

export function connectWs() {
  // Guard against double-connect (HMR, React Strict Mode)
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    return;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  console.log('[WS] Connecting...');
  const ws = new WebSocket(WS_URL);
  socket = ws;

  ws.onopen = () => {
    console.log('[WS] Connected');
    group = null;
    const store = usePanelStore.getState();
    store.setWs(ws);
    setLoggerWs(ws);
    captureConsoleLogs();
    ws.send(JSON.stringify({ type: 'initialize' }));

    // Discover panels
    loadAllPanels(ws).then((configs) => {
      console.log(`[WS] Discovered ${configs.length} panels`);
      usePanelStore.getState().setPanelConfigs(configs);
    }).catch((err) => {
      console.error('[WS] Panel discovery failed:', err);
    });
  };

  ws.onmessage = (event) => {
    try {
      const msg: WebSocketMessage = JSON.parse(event.data);
      handleMessage(msg);
    } catch (err) {
      console.error('[WS] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
    usePanelStore.getState().setWs(null);
    reconnectTimer = setTimeout(connectWs, 3000);
  };

  ws.onerror = (err) => {
    console.error('[WS] Error:', err);
  };
}

export function disconnectWs() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
}

// --- Message handling ---
// Every store read uses getState() — always fresh, no stale closures.

function handleMessage(msg: WebSocketMessage) {
  const store = usePanelStore.getState();
  const panel = store.currentPanel;

  switch (msg.type) {
    case 'connected':
      console.log('[WS] Session:', msg.sessionId);
      break;

    case 'turn_begin': {
      console.log('[WS] Turn begin');
      const panelState = store.panels[panel];
      if (panelState) {
        const prevTurn = panelState.currentTurn;
        const segments = panelState.segments;

        if (prevTurn) {
          store.addMessage(panel, {
            id: prevTurn.id,
            type: 'assistant',
            content: prevTurn.content,
            timestamp: Date.now(),
            segments: segments.length > 0 ? [...segments] : undefined,
          });
        }
      }

      store.resetSegments(panel);
      group = null;

      store.setCurrentTurn(panel, {
        id: msg.turnId || '',
        content: '',
        status: 'streaming',
        hasThinking: false,
        thinkingContent: '',
      });

      break;
    }

    case 'content':
      if (msg.text) {
        const t = (window as any).__TIMING;
        if (t && !t.firstTokenAt) {
          t.firstTokenAt = performance.now();
          t.firstTokenType = 'content';
          const ttft = t.firstTokenAt - t.sendAt;
          console.log(`[TIMING] FIRST TOKEN (content) at ${t.firstTokenAt.toFixed(1)}ms — TTFT: ${ttft.toFixed(1)}ms`);
        }
        group = null;
        store.appendSegment(panel, 'text', msg.text);

        const turn = usePanelStore.getState().panels[panel]?.currentTurn;
        if (turn) {
          store.updateTurnContent(panel, turn.content + msg.text);
        }
      }
      break;

    case 'thinking':
      if (msg.text) {
        const t = (window as any).__TIMING;
        if (t && !t.firstTokenAt) {
          t.firstTokenAt = performance.now();
          t.firstTokenType = 'thinking';
          const ttft = t.firstTokenAt - t.sendAt;
          console.log(`[TIMING] FIRST TOKEN (thinking) at ${t.firstTokenAt.toFixed(1)}ms — TTFT: ${ttft.toFixed(1)}ms`);
        }
        group = null;
        store.appendSegment(panel, 'think', msg.text);
      }
      break;

    case 'tool_call': {
      const segType = toolNameToSegmentType(msg.toolName || '');
      const toolCallId = msg.toolCallId || '';

      if (isGroupable(segType)) {
        if (group && group.type === segType) {
          group.toolCallIds.add(toolCallId);
          group.count++;
        } else {
          group = null;
          const segIndex = usePanelStore.getState().panels[panel]?.segments.length ?? 0;
          store.pushSegment(panel, {
            type: segType,
            content: '',
            toolCallId,
            toolArgs: msg.toolArgs,
          });
          group = {
            type: segType,
            segmentIndex: segIndex,
            toolCallIds: new Set([toolCallId]),
            count: 1,
          };
        }
      } else {
        group = null;
        store.pushSegment(panel, {
          type: segType,
          content: '',
          toolCallId,
        });
      }

      break;
    }

    case 'tool_result': {
      const toolCallId = msg.toolCallId || '';

      if (group && group.toolCallIds.has(toolCallId)) {
        const summaryFieldName = getSummaryField(group.type);
        const summaryValue = summaryFieldName && msg.toolArgs?.[summaryFieldName];
        const summaryLine = typeof summaryValue === 'string'
          ? summaryValue
          : msg.toolOutput?.slice(0, 80) || group.type;
        const prefix = usePanelStore.getState().panels[panel]?.segments[group.segmentIndex]?.content ? '\n' : '';
        store.appendSegmentContentByIndex(panel, group.segmentIndex, prefix + summaryLine);
      } else {
        if (toolCallId) {
          store.updateSegmentByToolCallId(panel, toolCallId, {
            content: msg.toolOutput || '',
            toolArgs: msg.toolArgs,
            toolDisplay: msg.toolDisplay,
            isError: msg.isError,
            complete: true,
          });
        }
      }

      break;
    }

    case 'turn_end': {
      const currentTurn = usePanelStore.getState().panels[panel]?.currentTurn;

      if (currentTurn) {
        const segs = usePanelStore.getState().panels[panel]?.segments || [];
        if (segs.length > 0) {
          const lastSeg = segs[segs.length - 1];
          if (!lastSeg.complete) {
            store.updateSegmentByToolCallId(panel, lastSeg.toolCallId || '', {
              complete: true,
            });
            if (!lastSeg.toolCallId) {
              store.updateLastSegment(panel, { complete: true });
            }
          }
        }
        store.setPendingTurnEnd(panel, true);
      }

      break;
    }

    case 'status_update':
      if (msg.contextUsage !== undefined) {
        store.setContextUsage(msg.contextUsage);
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

    // Thread management
    case 'thread:list':
      console.log('[WS] thread:list received:', msg.threads?.length, 'threads');
      if (msg.threads) {
        store.setThreads(msg.threads);
      }
      break;

    case 'thread:created':
      console.log('[WS] thread:created received:', msg.threadId, msg.thread);
      if (msg.thread && msg.threadId) {
        store.addThread({ threadId: msg.threadId, entry: msg.thread });
        store.setCurrentThreadId(msg.threadId);
        store.clearPanel(panel);
        loadRootTree();
      } else {
        console.error('[WS] thread:created missing data:', msg);
      }
      break;

    case 'thread:opened':
      console.log('[WS] thread:opened:', msg.threadId?.slice(0, 8), 'exchanges:', msg.exchanges?.length, 'history:', msg.history?.length);
      if (msg.threadId && msg.thread) {
        store.setCurrentThreadId(msg.threadId);
        store.clearPanel(panel);

        if (msg.exchanges && msg.exchanges.length > 0) {
          console.log('[WS] Loading', msg.exchanges.length, 'exchanges (rich format)');
          convertExchangesToMessages(panel, msg.exchanges);
        } else if (msg.history && msg.history.length > 0) {
          console.log('[WS] Loading', msg.history.length, 'messages (legacy format)');
          convertHistoryToMessages(panel, msg.history);
        }
      }
      break;

    case 'thread:renamed':
      if (msg.threadId && msg.name) {
        store.updateThread(msg.threadId, { name: msg.name });
      }
      break;

    case 'thread:deleted':
      if (msg.threadId) {
        store.removeThread(msg.threadId);
      }
      break;

    case 'message:sent':
      console.log('[WS] Message saved to thread');
      break;

    default:
      break;
  }
}

// --- History conversion helpers ---

function convertExchangesToMessages(panel: string, exchanges: ExchangeData[]) {
  const store = usePanelStore.getState();
  exchanges.forEach((exchange, idx) => {
    store.addMessage(panel, {
      id: `ex-${idx}-user`,
      type: 'user',
      content: exchange.user,
      timestamp: exchange.ts,
    });

    const segments = exchange.assistant.parts.map((part) => convertPartToSegment(part));
    const assistantContent = exchange.assistant.parts
      .filter((p): p is { type: 'text'; content: string } => p.type === 'text')
      .map((p) => p.content)
      .join('');

    store.addMessage(panel, {
      id: `ex-${idx}-assistant`,
      type: 'assistant',
      content: assistantContent,
      timestamp: exchange.ts,
      segments: segments.length > 0 ? segments : undefined,
    });
  });
}

function convertPartToSegment(part: AssistantPart): StreamSegment {
  if (part.type === 'text') {
    return { type: 'text', content: part.content };
  } else if (part.type === 'think') {
    return { type: 'think', content: part.content };
  } else {
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

function convertHistoryToMessages(
  panel: string,
  history: { role: 'user' | 'assistant'; content: string; hasToolCalls?: boolean }[],
) {
  const store = usePanelStore.getState();
  history.forEach((h, idx) => {
    store.addMessage(panel, {
      id: `hist-${idx}`,
      type: h.role,
      content: h.content,
      timestamp: Date.now() - (history.length - idx) * 1000,
    });
  });
}
