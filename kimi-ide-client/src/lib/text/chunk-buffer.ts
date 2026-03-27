/**
 * Text Chunk Buffer — Queue + speed attenuator for typing animation.
 *
 * Manages a queue of renderable chunks. Determines typing speed by
 * checking look-ahead:
 *
 *   → Next chunk buffered? → FAST (1ms per char, 5 chars/tick)
 *   → Only current chunk?  → SLOW (6ms per char, 1 char/tick)
 *
 * Effect: when tokens stream fast, text races. When they slow, typing decelerates.
 */

export const SPEED_FAST = 1;
export const SPEED_SLOW = 6;

export interface RenderedChunk {
  content: string;
  isFinal?: boolean;
}

export interface ChunkBuffer {
  push(chunk: RenderedChunk): void;
  hasNext(): boolean;
  next(): RenderedChunk | null;
  peek(): RenderedChunk | null;
  getSpeed(): 'fast' | 'slow';
  getSpeedMs(): number;
  size(): number;
  clear(): void;
}

export function createChunkBuffer(): ChunkBuffer {
  const chunks: RenderedChunk[] = [];
  let cursor = 0;

  return {
    push(chunk: RenderedChunk) {
      chunks.push(chunk);
    },

    hasNext(): boolean {
      return cursor < chunks.length;
    },

    next(): RenderedChunk | null {
      if (!this.hasNext()) return null;
      return chunks[cursor++];
    },

    peek(): RenderedChunk | null {
      if (cursor >= chunks.length) return null;
      return chunks[cursor];
    },

    getSpeed(): 'fast' | 'slow' {
      return cursor + 2 < chunks.length ? 'fast' : 'slow';
    },

    getSpeedMs(): number {
      return this.getSpeed() === 'fast' ? SPEED_FAST : SPEED_SLOW;
    },

    size(): number {
      return chunks.length - cursor;
    },

    clear() {
      chunks.length = 0;
      cursor = 0;
    },
  };
}
