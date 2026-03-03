// Workspace Types
export type WorkspaceId = 'code' | 'rocket' | 'issues' | 'scheduler' | 'skills' | 'wiki' | 'claw';

export interface WorkspaceConfig {
  name: string;
  color: string;
  icon: string;
  hasChat: boolean;
}

// Render State Machine Types
export type RenderPhase = 
  | 'idle'
  | 'ribbon_entering'    // 150ms minimum
  | 'ribbon_caught'       // Waiting for turn_begin
  | 'ribbon_completing'   // 200ms exit
  | 'pre_thinking_pause'  // 200ms delay
  | 'streaming';          // Active content rendering

// All segment types that can appear in the ordered stream
export type SegmentType =
  | 'think' | 'text'
  | 'shell' | 'read' | 'write' | 'edit'
  | 'glob' | 'grep' | 'web_search' | 'fetch'
  | 'subagent' | 'todo';

// Stream segment — one contiguous block in arrival order
export interface StreamSegment {
  type: SegmentType;
  content: string;
  icon?: string;
  label?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  toolDisplay?: unknown[];
  isError?: boolean;
}

// Message Types
export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Ordered segments (think + text inline) for assistant messages */
  segments?: StreamSegment[];
  /** Queue position when added to history; used for consistent render */
  releasedSegmentCount?: number;
}

export interface AssistantTurn {
  id: string;
  content: string;
  status: 'streaming' | 'complete';
  hasThinking: boolean;
  thinkingContent: string;
}

// Pulse Engine State — read-only snapshot from RenderEngine
export interface EngineState {
  phase: 'idle' | 'streaming' | 'complete';
  releasedSegmentCount: number;
  totalSegments: number;
  streaming: boolean;
}

// Workspace State
export interface WorkspaceState {
  // Messages
  messages: Message[];
  currentTurn: AssistantTurn | null;
  
  // Render State Machine
  renderPhase: RenderPhase;
  messageQueue: WebSocketMessage[];
  pendingTurnEnd: boolean;
  /** Message to add when typing completes; set at turn_end, cleared by finalizeTurn */
  pendingMessage: Message | null;
  
  // Ordered stream of segments (think and text inline, in arrival order)
  segments: StreamSegment[];

  /** Captured at finalize; used when adding to messages at turn_begin */
  lastReleasedSegmentCount: number;

  // Pulse engine state (populated by engine, read by components)
  engineState: EngineState | null;
}

// WebSocket Message Types
export type WebSocketMessageType = 
  | 'connected'
  | 'turn_begin'
  | 'content'
  | 'thinking'
  | 'turn_end'
  | 'step_begin'
  | 'status_update'
  | 'request'
  | 'response'
  | 'error'
  | 'tool_call'
  | 'tool_result';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  turnId?: string;
  text?: string;
  userInput?: string;
  fullText?: string;
  stepNumber?: number;
  contextUsage?: number;
  tokenUsage?: number;
  requestType?: string;
  payload?: any;
  requestId?: string;
  id?: string;
  result?: any;
  error?: any;
  sessionId?: string;
  toolName?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  toolOutput?: string;
  toolDisplay?: unknown[];
  isError?: boolean;
}

// Timing Constants
export const TIMING = {
  RIBBON_ENTER: 150,
  RIBBON_EXIT: 200,
  PRE_THINKING_PAUSE: 200,
  THINKING_MIN_DURATION: 800,
  TEXT_TYPEWRITER: 5,
  CODE_TYPEWRITER: 2,
  PULSE_SINGLE: 800,
  CODE_TRANSITION_DELAY: 400,
  CODE_RESUME_DELAY: 300,
} as const;

// Workspace Configurations
export const WORKSPACE_CONFIGS: Record<WorkspaceId, WorkspaceConfig> = {
  code: { name: 'Code Workspace', color: '#00d4ff', icon: 'code_blocks', hasChat: true },
  rocket: { name: 'Launchpad', color: '#f97316', icon: 'rocket', hasChat: true },
  issues: { name: 'Issues', color: '#facc15', icon: 'business_messages', hasChat: true },
  scheduler: { name: 'Scheduler', color: '#22c55e', icon: 'calendar_clock', hasChat: true },
  skills: { name: 'Skills', color: '#a855f7', icon: 'dynamic_form', hasChat: true },
  wiki: { name: 'Wiki', color: '#ec4899', icon: 'dataset_linked', hasChat: true },
  claw: { name: 'OpenClaw', color: '#ef4444', icon: 'smart_toy', hasChat: true }
};
