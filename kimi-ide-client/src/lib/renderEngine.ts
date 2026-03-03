const BEAT_MS = 500;

export interface EngineState {
  phase: 'idle' | 'streaming' | 'complete';
  releasedSegmentCount: number;
  totalSegments: number;
  streaming: boolean;
}

type Listener = (state: EngineState) => void;

function createInitialState(): EngineState {
  return {
    phase: 'idle',
    releasedSegmentCount: 0,
    totalSegments: 0,
    streaming: false,
  };
}

/**
 * Simple beat-driven engine.
 * 
 * - Components manage their own shimmer/typing/collapse timing
 * - Engine just releases segment indices on a 500ms beat
 * - When component finishes, it signals and engine releases next
 */
export class RenderEngine {
  private state: EngineState = createInitialState();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<Listener> = new Set();
  private pendingRelease = false;

  startTurn(): void {
    this.state = createInitialState();
    this.state.phase = 'streaming';
    this.state.streaming = true;
    this.notify();
  }

  setTotalSegments(count: number): void {
    const hadNoSegments = this.state.totalSegments === 0;
    this.state.totalSegments = count;
    
    // Auto-release first segment when it arrives
    if (hadNoSegments && count > 0 && this.state.releasedSegmentCount === 0) {
      this.releaseNext();
    }
    
    this.notify();
  }

  /**
   * Release next segment. Called:
   * - On 500ms beat (if previous segment done)
   * - Immediately when previous segment signals completion
   */
  releaseNext(): void {
    if (this.state.releasedSegmentCount < this.state.totalSegments) {
      this.state.releasedSegmentCount++;
      this.pendingRelease = false;
      this.notify();
    }
  }

  /**
   * Signal that current segment is done.
   * Engine will release next on next beat (or immediately if beat just passed).
   */
  segmentComplete(): void {
    this.pendingRelease = true;
  }

  endTurn(): void {
    this.state.phase = 'complete';
    this.state.streaming = false;
    this.stop();
    this.notify();
  }

  getState(): EngineState {
    return { ...this.state };
  }

  start(): void {
    if (this.intervalId !== null) return;
    // Release first segment immediately
    if (this.state.releasedSegmentCount === 0 && this.state.totalSegments > 0) {
      this.releaseNext();
    }
    this.intervalId = setInterval(() => {
      // On beat, release next if previous signaled complete
      if (this.pendingRelease) {
        this.releaseNext();
      }
    }, BEAT_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset(): void {
    this.stop();
    this.state = createInitialState();
    this.pendingRelease = false;
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const fn of this.listeners) {
      fn(snapshot);
    }
  }
}
