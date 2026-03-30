/**
 * Reveal Dispatcher — returns the reveal controller for a render mode.
 *
 * To add a new tool:
 * 1. Add it to segmentCatalog.ts (type, visual, behavior, renderMode)
 * 2. Create a reveal module in this directory
 * 3. Add it to the map below
 *
 * That's it. LiveToolSegment dispatches automatically.
 */

import type { RenderMode } from '../segmentCatalog';
import type { RevealController } from './types';
import { lineStreamReveal } from './line-stream';
import { groupedSummaryReveal } from './grouped-summary';

const REVEAL_MAP: Record<RenderMode, RevealController> = {
  'line-stream': lineStreamReveal,
  'grouped-summary': groupedSummaryReveal,
  // Stubs — use line-stream until dedicated modules exist
  'markdown': lineStreamReveal,
  'code': lineStreamReveal,
  'diff': lineStreamReveal,
};

export function getReveal(mode: RenderMode): RevealController {
  return REVEAL_MAP[mode];
}

export type { RevealController, RevealOptions } from './types';
