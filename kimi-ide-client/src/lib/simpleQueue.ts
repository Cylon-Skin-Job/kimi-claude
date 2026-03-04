/**
 * Simple Block Queue
 *
 * Strict sequential rendering: only one block animates at a time.
 * `activeBlockId` gates which block is currently running its lifecycle.
 * When a block's lifecycle completes, it calls `advanceBlock()` to
 * hand off to the next queued block.
 *
 * Supports mutable content updates (tokens accumulate into blocks).
 * Notifications batched via requestAnimationFrame for token streaming.
 */

export type BlockType = 'orb' | 'think' | 'text' | 'tool' | 'code';

export interface BlockMeta {
  segmentType?: string;
  language?: string;
  toolCallId?: string;
}

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  complete: boolean;
  header?: {
    icon: string;
    label: string;
  };
  meta?: BlockMeta;
}

export interface QueueState {
  blocks: Block[];
  activeBlockId: string | null;
}

type Listener = (state: QueueState) => void;

export class SimpleQueue {
  private state: QueueState = { blocks: [], activeBlockId: null };
  private listeners: Set<Listener> = new Set();
  private idCounter = 0;
  private rafId: number | null = null;
  private notifyPending = false;

  startTurn(): void {
    this.state.blocks = [];
    this.state.activeBlockId = null;
    this.idCounter = 0;
    this.notify();
  }

  addBlock(block: Omit<Block, 'id' | 'complete'> & { complete?: boolean }): string {
    const id = `block-${this.idCounter++}-${Date.now()}`;
    this.state.blocks.push({
      ...block,
      id,
      complete: block.complete ?? false,
    });

    // If no block is active, activate this one
    if (this.state.activeBlockId === null) {
      this.state.activeBlockId = id;
    }

    this.notify();
    return id;
  }

  /** Mutate content of an existing block */
  updateBlockContent(blockId: string, content: string): void {
    const block = this.state.blocks.find(b => b.id === blockId);
    if (block) {
      block.content = content;
      this.batchNotify();
    }
  }

  /** Mark a block as content-complete (no more tokens coming) */
  markBlockComplete(blockId: string): void {
    const block = this.state.blocks.find(b => b.id === blockId);
    if (block) {
      block.complete = true;
      this.notify();
    }
  }

  /**
   * Advance to the next block. Called by a block component when its
   * full lifecycle (including pauses) is done.
   */
  advanceBlock(): void {
    const { blocks, activeBlockId } = this.state;
    const idx = blocks.findIndex(b => b.id === activeBlockId);

    if (idx >= 0 && idx + 1 < blocks.length) {
      this.state.activeBlockId = blocks[idx + 1].id;
    } else {
      // No next block yet — will activate when one is added
      this.state.activeBlockId = null;
    }
    this.notify();
  }

  /** Remove a block from the queue (only orb uses this) */
  removeBlock(blockId: string): void {
    this.state.blocks = this.state.blocks.filter(b => b.id !== blockId);
    this.notify();
  }

  endTurn(): void {
    // Mark all blocks complete but don't remove — let animations finish
    for (const block of this.state.blocks) {
      block.complete = true;
    }
    this.notify();
  }

  getState(): QueueState {
    return { ...this.state };
  }

  getBlock(blockId: string): Block | undefined {
    return this.state.blocks.find(b => b.id === blockId);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Immediate notify — for structural changes (add/remove/complete/advance) */
  private notify(): void {
    this.cancelBatch();
    this.flush();
  }

  /** Batched notify via rAF — for rapid content updates (token streaming) */
  private batchNotify(): void {
    if (this.notifyPending) return;
    this.notifyPending = true;
    this.rafId = requestAnimationFrame(() => {
      this.notifyPending = false;
      this.rafId = null;
      this.flush();
    });
  }

  private cancelBatch(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.notifyPending = false;
  }

  private flush(): void {
    const snapshot = this.getState();
    for (const fn of this.listeners) {
      fn(snapshot);
    }
  }
}

// Singleton per workspace
const queues: Map<string, SimpleQueue> = new Map();

export function getQueue(workspace: string): SimpleQueue {
  if (!queues.has(workspace)) {
    queues.set(workspace, new SimpleQueue());
  }
  return queues.get(workspace)!;
}
