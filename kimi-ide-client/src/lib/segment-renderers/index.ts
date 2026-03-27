/**
 * Segment Content Renderers — index.
 * Maps renderMode to the corresponding renderer.
 *
 * NOTE: 'markdown' mode (text segments) is handled directly by
 * src/lib/text/ — text segments never go through this registry.
 */

import type { RenderMode } from '../segmentCatalog';
import type { SegmentContentRenderer } from './types';
import { lineStreamRenderer } from './line-stream';
import { diffRenderer } from './diff';
import { codeRenderer } from './code';
import { groupedSummaryRenderer } from './grouped-summary';

const RENDERERS: Partial<Record<RenderMode, SegmentContentRenderer>> = {
  'line-stream': lineStreamRenderer,
  'diff': diffRenderer,
  'code': codeRenderer,
  'grouped-summary': groupedSummaryRenderer,
};

export function getContentRenderer(mode: RenderMode): SegmentContentRenderer {
  const renderer = RENDERERS[mode];
  if (!renderer) {
    throw new Error(`No renderer for mode "${mode}" — text segments use src/lib/text/ directly`);
  }
  return renderer;
}

export type { SegmentContentRenderer } from './types';
