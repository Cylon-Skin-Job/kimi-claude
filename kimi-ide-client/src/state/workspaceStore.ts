import { create } from 'zustand';
import type { 
  WorkspaceId, 
  WorkspaceState, 
  RenderPhase, 
  Message, 
  AssistantTurn,
  WebSocketMessage,
  StreamSegment,
  EngineState
} from '../types';

// Initial workspace state factory
function createInitialWorkspaceState(): WorkspaceState {
  return {
    messages: [],
    currentTurn: null,
    renderPhase: 'idle',
    messageQueue: [],
    pendingTurnEnd: false,
    pendingMessage: null,
    segments: [],
    lastReleasedSegmentCount: 0,
    engineState: null
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
  setRenderPhase: (workspace: WorkspaceId, phase: RenderPhase) => void;
  queueMessage: (workspace: WorkspaceId, message: WebSocketMessage) => void;
  flushMessageQueue: (workspace: WorkspaceId) => WebSocketMessage[];
  appendSegment: (workspace: WorkspaceId, segType: StreamSegment['type'], text: string) => void;
  pushSegment: (workspace: WorkspaceId, segment: StreamSegment) => void;
  updateLastSegment: (workspace: WorkspaceId, updates: Partial<StreamSegment>) => void;
  updateSegmentByToolCallId: (workspace: WorkspaceId, toolCallId: string, updates: Partial<StreamSegment>) => void;
  resetSegments: (workspace: WorkspaceId) => void;
  setPendingTurnEnd: (workspace: WorkspaceId, pending: boolean) => void;
  setPendingMessage: (workspace: WorkspaceId, message: Message | null) => void;
  finalizeTurn: (workspace: WorkspaceId) => void;
  clearWorkspace: (workspace: WorkspaceId) => void;
  
  // Engine state (written by engine, read by components)
  setEngineState: (workspace: WorkspaceId, engineState: EngineState) => void;
  
  // WebSocket
  ws: WebSocket | null;
  setWs: (ws: WebSocket | null) => void;
  
  // Context usage
  contextUsage: number;
  setContextUsage: (usage: number) => void;
}

export const useWorkspaceStore = create<AppState>((set, get) => ({
  // Initial state
  currentWorkspace: 'code',
  workspaces: {
    code: createInitialWorkspaceState(),
    rocket: createInitialWorkspaceState(),
    issues: createInitialWorkspaceState(),
    scheduler: createInitialWorkspaceState(),
    skills: createInitialWorkspaceState(),
    wiki: createInitialWorkspaceState(),
    claw: createInitialWorkspaceState()
  },
  ws: null,
  contextUsage: 0,
  
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
  
  setRenderPhase: (workspace, phase) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: {
        ...state.workspaces[workspace],
        renderPhase: phase
      }
    }
  })),
  
  queueMessage: (workspace, message) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: {
        ...state.workspaces[workspace],
        messageQueue: [...state.workspaces[workspace].messageQueue, message]
      }
    }
  })),
  
  flushMessageQueue: (workspace) => {
    const state = get();
    const messages = [...state.workspaces[workspace].messageQueue];
    
    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [workspace]: {
          ...state.workspaces[workspace],
          messageQueue: []
        }
      }
    }));
    
    return messages;
  },
  
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
    const eng = ws.engineState;
    if (turn) {
      set((s) => ({
        workspaces: {
          ...s.workspaces,
          [workspace]: {
            ...s.workspaces[workspace],
            currentTurn: { ...turn, status: 'complete' },
            pendingTurnEnd: false,
            pendingMessage: null,
            lastReleasedSegmentCount: eng?.releasedSegmentCount ?? ws.segments.length
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
  
  // Ribbon actions
  // Engine state (written by engine)
  setEngineState: (workspace, engineState) => set((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspace]: {
        ...state.workspaces[workspace],
        engineState
      }
    }
  }))
}));
