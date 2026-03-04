/**
 * Block Queue Render Engine
 * 
 * Manages sequential block rendering with proper timing cycles.
 * Each block goes through: fade_in → shimmer_cycles → content → close → shimmer_cycles
 * The hasNext flag controls when to advance to the next block.
 */

export type BlockPhase =
  | 'idle'
  | 'fade_in'            // 250ms header fade
  | 'shimmer'            // 500ms cycles, loops until hasNext
  | 'pre_content_pause'  // 500ms
  | 'content'            // typing content
  | 'post_content_pause' // 500ms
  | 'collapse'           // 300ms drawer close
  | 'post_close_shimmer' // 500ms cycles, loops until hasNext
  | 'complete';

export interface Block {
  id: string;
  type: 'think' | 'text' | 'tool' | 'code';
  content: string;
  header?: {
    icon: string;
    label: string;
  };
  isComplete: boolean;  // Set when end tag received
}

export interface QueueState {
  blocks: Block[];
  currentIndex: number;
  phase: BlockPhase;
  hasNext: boolean;
  isStreaming: boolean;
  shimmerCycle: number;  // Current shimmer cycle count
}

const TIMING = {
  FADE_IN: 250,
  SHIMMER_CYCLE: 500,
  PRE_CONTENT_PAUSE: 500,
  POST_CONTENT_PAUSE: 500,
  COLLAPSE: 300,
} as const;

type QueueListener = (state: QueueState) => void;

export class BlockQueue {
  private state: QueueState = {
    blocks: [],
    currentIndex: 0,
    phase: 'idle',
    hasNext: false,
    isStreaming: false,
    shimmerCycle: 0,
  };
  
  private listeners: Set<QueueListener> = new Set();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  // Start a new turn
  startTurn(): void {
    this.clearTimeout();
    this.state = {
      blocks: [],
      currentIndex: 0,
      phase: 'idle',
      hasNext: false,
      isStreaming: true,
      shimmerCycle: 0,
    };
    this.notify();
  }
  
  // Add or update a block
  addBlock(block: Omit<Block, 'id'>): void {
    const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newBlock: Block = { ...block, id };
    
    // Check if we should append to existing block or create new
    const currentBlock = this.state.blocks[this.state.blocks.length - 1];
    if (currentBlock && currentBlock.type === block.type && !currentBlock.isComplete) {
      // Append content to existing block
      currentBlock.content += block.content;
      this.notify();
      return;
    }
    
    // New block
    this.state.blocks.push(newBlock);
    
    // If first block and idle, start it
    if (this.state.blocks.length === 1 && this.state.phase === 'idle') {
      this.advanceToPhase('fade_in');
    }
    
    this.notify();
  }
  
  // Mark a block as complete (end tag received)
  completeBlock(index: number): void {
    if (this.state.blocks[index]) {
      this.state.blocks[index].isComplete = true;
      
      // If this is the current block, set hasNext for previous to finish
      if (index === this.state.currentIndex + 1) {
        this.state.hasNext = true;
      }
      
      this.notify();
    }
  }
  
  // Mark current block content as complete
  markCurrentComplete(): void {
    const current = this.state.blocks[this.state.currentIndex];
    if (current) {
      current.isComplete = true;
      this.state.hasNext = true;
      this.notify();
    }
  }
  
  // End streaming
  endTurn(): void {
    this.state.isStreaming = false;
    // Mark all remaining blocks as complete
    this.state.blocks.forEach(b => b.isComplete = true);
    this.state.hasNext = true;
    this.notify();
  }
  
  // Advance to next phase
  private advanceToPhase(phase: BlockPhase): void {
    this.state.phase = phase;
    this.state.shimmerCycle = 0;
    this.scheduleNext();
    this.notify();
  }
  
  // Schedule next phase based on current
  private scheduleNext(): void {
    this.clearTimeout();
    
    const { phase, hasNext, isStreaming, shimmerCycle } = this.state;
    
    switch (phase) {
      case 'fade_in':
        this.timeoutId = setTimeout(() => {
          this.advanceToPhase('shimmer');
        }, TIMING.FADE_IN);
        break;
        
      case 'shimmer':
        // Check if we should continue shimmering or advance
        if (hasNext || shimmerCycle === 0) {
          // Must shimmer at least once, then check hasNext
          if (shimmerCycle >= 1 && hasNext) {
            this.timeoutId = setTimeout(() => {
              this.advanceToPhase('pre_content_pause');
            }, TIMING.SHIMMER_CYCLE);
          } else {
            // Continue shimmering
            this.state.shimmerCycle++;
            this.timeoutId = setTimeout(() => {
              this.scheduleNext(); // Recheck
            }, TIMING.SHIMMER_CYCLE);
            this.notify();
          }
        } else {
          // No next yet, keep shimmering
          this.state.shimmerCycle++;
          this.timeoutId = setTimeout(() => {
            this.scheduleNext(); // Recheck
          }, TIMING.SHIMMER_CYCLE);
          this.notify();
        }
        break;
        
      case 'pre_content_pause':
        this.timeoutId = setTimeout(() => {
          this.advanceToPhase('content');
        }, TIMING.PRE_CONTENT_PAUSE);
        break;
        
      case 'content':
        // Content phase waits for typing to complete
        // This is handled by the component, which calls completeCurrentBlock()
        break;
        
      case 'post_content_pause':
        this.timeoutId = setTimeout(() => {
          this.advanceToPhase('collapse');
        }, TIMING.POST_CONTENT_PAUSE);
        break;
        
      case 'collapse':
        this.timeoutId = setTimeout(() => {
          this.advanceToPhase('post_close_shimmer');
        }, TIMING.COLLAPSE);
        break;
        
      case 'post_close_shimmer':
        // Similar to shimmer phase
        if (hasNext || !isStreaming) {
          if (shimmerCycle >= 1) {
            this.moveToNextBlock();
          } else {
            this.state.shimmerCycle++;
            this.timeoutId = setTimeout(() => {
              this.scheduleNext();
            }, TIMING.SHIMMER_CYCLE);
            this.notify();
          }
        } else {
          // Keep shimmering
          this.state.shimmerCycle++;
          this.timeoutId = setTimeout(() => {
            this.scheduleNext();
          }, TIMING.SHIMMER_CYCLE);
          this.notify();
        }
        break;
        
      case 'complete':
        // Done
        break;
    }
  }
  
  // Move to next block
  private moveToNextBlock(): void {
    this.state.currentIndex++;
    this.state.hasNext = false;
    this.state.shimmerCycle = 0;
    
    if (this.state.currentIndex < this.state.blocks.length) {
      this.advanceToPhase('fade_in');
    } else {
      this.state.phase = 'complete';
      this.notify();
    }
  }
  
  // Called by component when content typing completes
  contentComplete(): void {
    if (this.state.phase === 'content') {
      this.advanceToPhase('post_content_pause');
    }
  }
  
  // Reset
  reset(): void {
    this.clearTimeout();
    this.state = {
      blocks: [],
      currentIndex: 0,
      phase: 'idle',
      hasNext: false,
      isStreaming: false,
      shimmerCycle: 0,
    };
    this.notify();
  }
  
  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
  
  getState(): QueueState {
    return { ...this.state };
  }
  
  subscribe(fn: QueueListener): () => void {
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

// Singleton instance per workspace
const queues: Map<string, BlockQueue> = new Map();

export function getQueue(workspace: string): BlockQueue {
  if (!queues.has(workspace)) {
    queues.set(workspace, new BlockQueue());
  }
  return queues.get(workspace)!;
}
