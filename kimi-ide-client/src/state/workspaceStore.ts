import { create } from 'zustand';
import type {
  WorkspaceId,
  WorkspaceState,
  Message,
  AssistantTurn,
  StreamSegment,
  Thread
} from '../types';

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
  // Current workspace
  currentWorkspace: WorkspaceId;
  setCurrentWorkspace: (id: WorkspaceId) => void;

  // Per-workspace states
  workspaces: Record<WorkspaceId, WorkspaceState>;

  // Workspace actions
  addMessage: (workspace: WorkspaceId, message: Message) => void;
  setCurrentTurn: (workspace: WorkspaceId, turn: AssistantTurn | null) => void;
  updateTurnContent: (workspace: WorkspaceId, content: string) => void;
  appendSegment: (workspace: WorkspaceId, segType: StreamSegment['type'], text: string) => void;
  pushSegment: (workspace: WorkspaceId, segment: StreamSegment) => void;
  updateLastSegment: (workspace: WorkspaceId, updates: Partial<StreamSegment>) => void;
  updateSegmentByToolCallId: (workspace: WorkspaceId, toolCallId: string, updates: Partial<StreamSegment>) => void;
  resetSegments: (workspace: WorkspaceId) => void;
  setPendingTurnEnd: (workspace: WorkspaceId, pending: boolean) => void;
  setPendingMessage: (workspace: WorkspaceId, message: Message | null) => void;
  finalizeTurn: (workspace: WorkspaceId) => void;
  clearWorkspace: (workspace: WorkspaceId) => void;

  // WebSocket
  ws: WebSocket | null;
  setWs: (ws: WebSocket | null) => void;

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

export const useWorkspaceStore = create<AppState>((set, get) => ({
  // Initial state
  currentWorkspace: 'coding-agent',
  workspaces: {
    capture: createInitialWorkspaceState(),
    'coding-agent': createInitialWorkspaceState(),
    rocket: createInitialWorkspaceState(),
    issues: createInitialWorkspaceState(),
    skills: createInitialWorkspaceState(),
    wiki: createInitialWorkspaceState(),
    claw: createInitialWorkspaceState()
  },
  ws: null,
  contextUsage: 0,
  threads: [],
  currentThreadId: null,

  // Actions
  setCurrentWorkspace: (id) => set({ currentWorkspace: id }),

  addMessage: (workspace, message) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: {
        ...state.workspaces[workspace],
        messages: [...state.workspaces[workspace].messages, message]
      }
    }
  })),

  setCurrentTurn: (workspace, turn) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: {
        ...state.workspaces[workspace],
        currentTurn: turn
      }
    }
  })),

  updateTurnContent: (workspace, content) => set((state) => {
    const turn = state.workspaces[workspace].currentTurn;
    if (!turn) return state;

    return {
      workspaces: {
        ...state.workspaces,
        [workspace]: {
          ...state.workspaces[workspace],
          currentTurn: { ...turn, content }
        }
      }
    };
  }),

  appendSegment: (workspace, segType, text) => set((state) => {
    const ws = state.workspaces[workspace];
    const segments = [...ws.segments];
    const last = segments[segments.length - 1];
    if (last && last.type === segType) {
      segments[segments.length - 1] = { ...last, content: last.content + text };
    } else {
      segments.push({ type: segType, content: text });
    }
    return {
      workspaces: { ...state.workspaces, [workspace]: { ...ws, segments } }
    };
  }),

  pushSegment: (workspace, segment) => set((state) => {
    const ws = state.workspaces[workspace];
    return {
      workspaces: { ...state.workspaces, [workspace]: { ...ws, segments: [...ws.segments, segment] } }
    };
  }),

  updateLastSegment: (workspace, updates) => set((state) => {
    const ws = state.workspaces[workspace];
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
    const ws = state.workspaces[workspace];
    const idx = ws.segments.findIndex((s) => s.toolCallId === toolCallId);
    if (idx < 0) return state;
    const segments = [...ws.segments];
    segments[idx] = { ...segments[idx], ...updates };
    return {
      workspaces: { ...state.workspaces, [workspace]: { ...ws, segments } }
    };
  }),

  resetSegments: (workspace) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: {
        ...state.workspaces[workspace],
        segments: []
      }
    }
  })),

  setPendingTurnEnd: (workspace, pending) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: {
        ...state.workspaces[workspace],
        pendingTurnEnd: pending
      }
    }
  })),

  setPendingMessage: (workspace, message) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: {
        ...state.workspaces[workspace],
        pendingMessage: message
      }
    }
  })),

  finalizeTurn: (workspace) => {
    const state = get();
    const ws = state.workspaces[workspace];
    const turn = ws.currentTurn;
    if (turn) {
      set((s) => ({
        workspaces: {
          ...s.workspaces,
          [workspace]: {
            ...s.workspaces[workspace],
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
