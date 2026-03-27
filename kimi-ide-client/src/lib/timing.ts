/**
 * Universal Tool Call Timing — single source of truth.
 *
 * Every tool block follows this sequence:
 *
 *   fade-in (300ms) → shimmer hold (200ms) → reveal → collapse
 *
 * Adjust values here. They apply to ALL tool types.
 */

// ── Shimmer Phase ──
/** CSS opacity fade-in for tool block header */
export const SHIMMER_FADE_IN = 200;
/** Hold after fade-in before first chunk check (shimmer visible, no content) */
export const SHIMMER_HOLD = 200;
/** Total shimmer duration before reveal starts */
export const SHIMMER_TOTAL = SHIMMER_FADE_IN + SHIMMER_HOLD;

// ── Reveal Phase ──
/** Pause between typing chunks within a reveal */
export const INTER_CHUNK_PAUSE = 80;

// ── Collapse Phase ──
/** Pause after reveal ends before fold starts (shimmer off, content visible) */
export const POST_TYPING_PAUSE = 500;
/** Duration of the maxHeight fold animation */
export const COLLAPSE_DURATION = 300;

// ── Between Segments ──
/** Pause after collapse before next segment starts */
export const INTER_SEGMENT_PAUSE = 250;

// ── Orb ──
/** Fixed orb animation duration (gatekeeper, not a tool) */
export const ORB_DURATION = 2000;
