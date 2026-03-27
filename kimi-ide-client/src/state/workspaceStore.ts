import { create } from 'zustand';
import type {
  WorkspaceState,
  Message,
  AssistantTurn,
  StreamSegment,
  Thread
} from '../types';
import type { WorkspaceConfig } from '../lib/workspaces';

// Initial workspace state factory
function createInitialWorkspaceState(): WorkspaceState {
  return {
    messages: [],
    currentTurn: null,
    pendingTurnEnd: false,
    pendingMessage: null,
    segments: [],
    lastReleasedSegmentCount: 0
  };
}

interface AppState {
  // Workspace configs (dynamically discovered)
  workspaceConfigs: WorkspaceConfig[];
  setWorkspaceConfigs: (configs: WorkspaceConfig[]) => void;
  getWorkspaceConfig: (id: string) => WorkspaceConfig | undefined;

  // Current workspace
  currentWorkspace: string;
  setCurrentWorkspace: (id: string) => void;

  // Per-workspace states (dynamically initialized)
  workspaces: Record<string, WorkspaceState>;

  // Workspace actions
  addMessage: (workspace: string, message: Message) => void;
  setCurrentTurn: (workspace: string, turn: AssistantTurn | null) => void;
  updateTurnContent: (workspace: string, content: string) => void;
  appendSegment: (workspace: string, segType: StreamSegment['type'], text: string) => void;
  pushSegment: (workspace: string, segment: StreamSegment) => void;
  updateLastSegment: (workspace: string, updates: Partial<StreamSegment>) => void;
  updateSegmentByToolCallId: (workspace: string, toolCallId: string, updates: Partial<StreamSegment>) => void;
  appendSegmentContentByIndex: (workspace: string, index: number, text: string) => void;
  resetSegments: (workspace: string) => void;
  setPendingTurnEnd: (workspace: string, pending: boolean) => void;
  setPendingMessage: (workspace: string, message: Message | null) => void;
  finalizeTurn: (workspace: string) => void;
  clearWorkspace: (workspace: string) => void;

  // WebSocket
  ws: WebSocket | null;
  setWs: (ws: WebSocket | null) => void;
  sendMessage: (text: string, workspace?: string) => void;

  // Context usage
  contextUsage: number;
  setContextUsage: (usage: number) => void;

  // Thread management
  threads: Thread[];
  currentThreadId: string | null;
  setThreads: (threads: Thread[]) => void;
  setCurrentThreadId: (threadId: string | null) => void;
  addThread: (thread: Thread) => void;
  updateThread: (threadId: string, updates: Partial<Thread['entry']>) => void;
  removeThread: (threadId: string) => void;
}

/**
 * Helper: get workspace state, auto-initializing if needed.
 * This ensures workspace actions work even before discovery completes.
 */
function getWs(state: AppState, workspace: string): WorkspaceState {
  return state.workspaces[workspace] || createInitialWorkspaceState();
}

export const useWorkspaceStore = create<AppState>((set, get) => ({
  // Workspace configs — empty until discovery populates them
  workspaceConfigs: [],
  setWorkspaceConfigs: (configs) => {
    const existing = get().workspaces;
    const workspaces: Record<string, WorkspaceState> = { ...existing };
    for (const config of configs) {
      if (!workspaces[config.id]) {
        workspaces[config.id] = createInitialWorkspaceState();
      }
    }
    set({ workspaceConfigs: configs, workspaces });
  },
  getWorkspaceConfig: (id) => get().workspaceConfigs.find((c) => c.id === id),

  // Initial state — empty until discovery populates
  currentWorkspace: 'coding-agent',
  workspaces: {},
  ws: null,
  contextUsage: 0,
  threads: [],
  currentThreadId: null,

  // Actions
  setCurrentWorkspace: (id) => {
    // Auto-initialize workspace state if not yet created
    const state = get();
    if (!state.workspaces[id]) {
      set({
        currentWorkspace: id,
        workspaces: { ...state.workspaces, [id]: createInitialWorkspaceState() }
      });
    } else {
      set({ currentWorkspace: id });
    }
  },

  addMessage: (workspace, message) => set((state) => {
    const ws = getWs(state, workspace);
    return {
      workspaces: {
        ...state.workspaces,
        [workspace]: { ...ws, messages: [...ws.messages, message] }
      }
    };
  }),

  setCurrentTurn: (workspace, turn) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: { ...getWs(state, workspace), currentTurn: turn }
    }
  })),

  updateTurnContent: (workspace, content) => set((state) => {
    const ws = getWs(state, workspace);
    if (!ws.currentTurn) return state;
    return {
      workspaces: {
        ...state.workspaces,
        [workspace]: { ...ws, currentTurn: { ...ws.currentTurn, content } }
      }
    };
  }),

  appendSegment: (workspace, segType, text) => set((state) => {
    const ws = getWs(state, workspace);
    const segments = [...ws.segments];
    const last = segments[segments.length - 1];
    if (last && last.type === segType) {
      // Same type — append content
      segments[segments.length - 1] = { ...last, content: last.content + text };
    } else {
      // New type — mark prior segment complete (closing tag), push new one
      if (last && !last.complete) {
        segments[segments.length - 1] = { ...last, complete: true };
      }
      segments.push({ type: segType, content: text });
    }
    return {
      workspaces: { ...state.workspaces, [workspace]: { ...ws, segments } }
    };
  }),

  pushSegment: (workspace, segment) => set((state) => {
    const ws = getWs(state, workspace);
    const segments = [...ws.segments];
    // Mark prior segment complete before pushing new one
    const last = segments[segments.length - 1];
    if (last && !last.complete) {
      segments[segments.length - 1] = { ...last, complete: true };
    }
    segments.push(segment);
    return {
      workspaces: { ...state.workspaces, [workspace]: { ...ws, segments } }
    };
  }),

  updateLastSegment: (workspace, updates) => set((state) => {
    const ws = getWs(state, workspace);
    const segments = [...ws.segments];
    const last = segments[segments.length - 1];
    if (last) {
      segments[segments.length - 1] = { ...last, ...updates };
    }
    return {
      workspaces: { ...state.workspaces, [workspace]: { ...ws, segments } }
    };
  }),

  updateSegmentByToolCallId: (workspace, toolCallId, updates) => set((state) => {
    const ws = getWs(state, workspace);
    const idx = ws.segments.findIndex((s) => s.toolCallId === toolCallId);
    if (idx < 0) return state;
    const segments = [...ws.segments];
    segments[idx] = { ...segments[idx], ...updates };
    return {
      workspaces: { ...state.workspaces, [workspace]: { ...ws, segments } }
    };
  }),

  appendSegmentContentByIndex: (workspace, index, text) => set((state) => {
    const ws = getWs(state, workspace);
    if (index < 0 || index >= ws.segments.length) return state;
    const segments = [...ws.segments];
    segments[index] = { ...segments[index], content: segments[index].content + text };
    return {
      workspaces: { ...state.workspaces, [workspace]: { ...ws, segments } }
    };
  }),

  resetSegments: (workspace) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: { ...getWs(state, workspace), segments: [] }
    }
  })),

  setPendingTurnEnd: (workspace, pending) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: { ...getWs(state, workspace), pendingTurnEnd: pending }
    }
  })),

  setPendingMessage: (workspace, message) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: { ...getWs(state, workspace), pendingMessage: message }
    }
  })),

  finalizeTurn: (workspace) => {
    const state = get();
    const ws = getWs(state, workspace);
    const turn = ws.currentTurn;
    if (turn) {
      set((s) => ({
        workspaces: {
          ...s.workspaces,
          [workspace]: {
            ...getWs(s, workspace),
            currentTurn: { ...turn, status: 'complete' },
            pendingTurnEnd: false,
            pendingMessage: null,
            lastReleasedSegmentCount: ws.segments.length
          }
        }
      }));
    }
  },

  clearWorkspace: (workspace) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: createInitialWorkspaceState()
    }
  })),

  setWs: (ws) => set({ ws }),
  sendMessage: (text, workspace) => {
    const state = get();
    const socket = state.ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      const now = performance.now();
      (window as any).__TIMING = { sendAt: now, firstTokenAt: 0, firstTokenType: '' };
      console.log(`[TIMING] SEND at ${now.toFixed(1)}ms`);
      socket.send(JSON.stringify({
        type: 'prompt',
        user_input: text,
        workspace: workspace || state.currentWorkspace,
        threadId: state.currentThreadId,
      }));
    }
  },
  setContextUsage: (usage) => set({ contextUsage: usage }),

  // Thread actions
  setThreads: (threads) => set({ threads }),
  setCurrentThreadId: (threadId) => set({ currentThreadId: threadId }),
  addThread: (thread) => set((state) => ({
    threads: [thread, ...state.threads]
  })),
  updateThread: (threadId, updates) => set((state) => ({
    threads: state.threads.map(t =>
      t.threadId === threadId ? { ...t, entry: { ...t.entry, ...updates } } : t
    )
  })),
  removeThread: (threadId) => set((state) => ({
    threads: state.threads.filter(t => t.threadId !== threadId),
    currentThreadId: state.currentThreadId === threadId ? null : state.currentThreadId
  })),

}));
