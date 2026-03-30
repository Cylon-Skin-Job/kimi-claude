/**
 * Chunk Strategy Registry — maps segment type to its speed decomposition rules.
 *
 * Three registries per tool type:
 *   1. segmentCatalog.ts    → icon, label, colors
 *   2. tool-renderers/      → content style, format, grouping
 *   3. chunk-strategies/    → what counts as a speed-relevant queue item
 *
 * The speed attenuator (lib/text/speed-attenuator.ts) is generic.
 * This registry tells it what to count.
 */

import type { SegmentType } from '../../types';
import type { ChunkStrategy } from './types';
import { textStrategy } from './text';
import { thinkStrategy } from './think';
import { shellStrategy } from './shell';
import { readStrategy } from './read';
import { writeStrategy } from './write';
import { lineStrategy } from './line';

const REGISTRY: Record<string, ChunkStrategy> = {
  text: textStrategy,
  think: thinkStrategy,
  shell: shellStrategy,
  read: readStrategy,
  glob: readStrategy,     // same as read — per-call grouped
  grep: readStrategy,     // same as read — per-call grouped
  write: writeStrategy,
  edit: writeStrategy,    // same as write for now — future: hunk-level
  web_search: readStrategy,
  fetch: readStrategy,
  subagent: lineStrategy,
  todo: lineStrategy,
};

/** Default for unknown types — line-by-line, tag as first chunk. */
const fallback: ChunkStrategy = {
  mode: 'line',
  tagAsFirstChunk: true,
};

export function getChunkStrategy(type: SegmentType | string): ChunkStrategy {
  return REGISTRY[type] || fallback;
}

export type { ChunkStrategy } from './types';
