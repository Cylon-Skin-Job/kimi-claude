/**
 * Text Module — entry point.
 *
 * Re-exports chunk boundary detection, buffer, HTML utils, and sub-renderers.
 * The sub-renderers are ordered by specificity: code fence > header > list > paragraph.
 * The dispatcher tries each in order; paragraph is the fallback.
 */

export { getTextChunkBoundary, getCodeChunkBoundary, getCodeCommentBoundary, formattingIsBalanced } from './chunk-boundary';
export { createChunkBuffer } from './chunk-buffer';
export type { ChunkBuffer, RenderedChunk } from './chunk-buffer';
export { SPEED_FAST, SPEED_SLOW, computeSpeed, speedToMs } from './speed-attenuator';
export type { QueueItem, AttenuatorOptions } from './speed-attenuator';
export { truncateHtmlToChars, getVisibleTextLength } from './html-utils';

// Sub-type renderers (ordered by match specificity)
export { codeFenceRenderer } from './renderers/code-fence';
export { headerRenderer } from './renderers/header';
export { listRenderer } from './renderers/list';
export { paragraphRenderer } from './renderers/paragraph';
export type { TextSubRenderer } from './renderers/types';

import { codeFenceRenderer } from './renderers/code-fence';
import { headerRenderer } from './renderers/header';
import { listRenderer } from './renderers/list';
import { paragraphRenderer } from './renderers/paragraph';
import type { TextSubRenderer } from './renderers/types';
import { formattingIsBalanced as isBalanced } from './chunk-boundary';

/**
 * Ordered list of sub-renderers. First match wins.
 * Paragraph is last — it's the fallback for anything unmatched.
 */
const SUB_RENDERERS: TextSubRenderer[] = [
  codeFenceRenderer,
  headerRenderer,
  listRenderer,
  paragraphRenderer,
];

/**
 * Identify which sub-renderer handles the content at the given position.
 */
export function getTextSubRenderer(content: string, fromIndex: number): TextSubRenderer {
  for (const renderer of SUB_RENDERERS) {
    if (renderer.matches(content, fromIndex)) {
      return renderer;
    }
  }
  return paragraphRenderer;
}

/** Stall threshold — force a chunk break after this many chars with no boundary */
const STALL_THRESHOLD = 500;

/**
 * Parse streaming text content into chunks using type-specific sub-renderers.
 * Replaces the old monolithic markdownRenderer.parseChunks().
 *
 * Each chunk corresponds to one sub-block (paragraph, header, code fence, list).
 * Includes a 500-char stall safety to prevent infinite waits on long unbroken text.
 */
export function parseTextChunks(content: string): string[] {
  const chunks: string[] = [];
  let fromIndex = 0;

  while (fromIndex < content.length) {
    const renderer = getTextSubRenderer(content, fromIndex);
    const boundary = renderer.findBoundary(content, fromIndex);

    if (boundary > fromIndex) {
      chunks.push(content.slice(fromIndex, boundary));
      fromIndex = boundary;
    } else {
      // No complete boundary yet.
      //
      // CODE FENCES: Wait for the closing ```. Do NOT push partial
      // content. The code block is one atomic unit — we don't type
      // it until it's complete. The cursor blinks at the paragraph
      // boundary while the code block streams in. When the closing
      // ``` arrives, the full fence is produced as one chunk.
      //
      // This also prevents cursor drift: a partial code fence pushed
      // now would have a different length when the closing tag arrives,
      // causing the index-based tracking to lose characters.
      const isCodeFence = codeFenceRenderer.matches(content, fromIndex);
      if (isCodeFence) {
        // Don't push anything — wait for the closing ```
        break;
      }

      // Other block types (paragraphs, lists): push partial content
      // so the user sees text appearing as it streams.
      const pending = content.length - fromIndex;
      if (pending >= STALL_THRESHOLD) {
        // Force break at last balanced whitespace
        const beforeStall = fromIndex;
        for (let i = content.length; i > fromIndex; i--) {
          const ch = content[i - 1];
          if (ch === ' ' || ch === '\n') {
            if (isBalanced(content.slice(fromIndex, i))) {
              chunks.push(content.slice(fromIndex, i));
              fromIndex = i;
              break;
            }
          }
        }
        // If no safe break found, take everything to prevent infinite loop
        if (fromIndex === beforeStall) {
          chunks.push(content.slice(fromIndex));
          fromIndex = content.length;
        }
      } else {
        // Not enough content yet — take what we have as a partial chunk
        chunks.push(content.slice(fromIndex));
        break;
      }
    }
  }

  if (chunks.length === 0 && content.length > 0) {
    chunks.push(content);
  }

  return chunks;
}

/**
 * Render text content to HTML instantly (no animation).
 * Routes each block through its sub-renderer's toHtml() for per-type consistency.
 */
export function renderTextInstant(content: string): string {
  if (!content) return '';

  const parts: string[] = [];
  let fromIndex = 0;

  while (fromIndex < content.length) {
    const renderer = getTextSubRenderer(content, fromIndex);
    const boundary = renderer.findBoundary(content, fromIndex);
    const end = boundary > fromIndex ? boundary : content.length;
    parts.push(renderer.toHtml(content.slice(fromIndex, end)));
    fromIndex = end;
  }

  return parts.join('');
}
