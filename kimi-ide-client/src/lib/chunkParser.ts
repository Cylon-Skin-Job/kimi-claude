/**
 * Chunk Parser — Semantic boundary detection for content rendering
 *
 * Instead of rendering character-by-character, we buffer content until a
 * complete semantic chunk is available (paragraph, header, list item, code line),
 * then render the whole chunk at once.
 *
 * Pure utility — no React or queue dependencies.
 */

/** Maximum chars to accumulate before forcing a render at the best available boundary */
const STALL_THRESHOLD = 500;

/**
 * Check whether formatting markers are balanced in the given text.
 * Scans for unmatched `**` (bold) and `` ` `` (inline code) markers.
 * Skips escaped markers (`\*`) and skips bold detection inside inline code spans.
 */
export function formattingIsBalanced(text: string): boolean {
  let inCode = false;
  let boldCount = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    // Skip escaped characters
    if (ch === '\\' && i + 1 < text.length) {
      i++; // skip next char
      continue;
    }

    // Toggle inline code
    if (ch === '`') {
      inCode = !inCode;
      continue;
    }

    // Count bold markers only outside inline code
    if (!inCode && ch === '*' && i + 1 < text.length && text[i + 1] === '*') {
      boldCount++;
      i++; // skip second *
    }
  }

  // Unclosed inline code or odd bold markers = unbalanced
  return !inCode && boldCount % 2 === 0;
}

/**
 * Find the next safe text chunk boundary.
 *
 * Scans forward from `fromIndex` looking for:
 *   1. Paragraph break (`\n\n`)
 *   2. Header line (`# ` at line start + `\n`)
 *   3. List item (`- `, `* `, `1. ` at line start + `\n`)
 *   4. Single newline (line boundary)
 *
 * Before accepting any boundary, verifies formatting is balanced up to that point.
 * If 500+ chars accumulate with no balanced boundary, finds the last safe point.
 * Returns `fromIndex` if no boundary found yet — caller should poll again.
 */
export function getTextChunkBoundary(
  content: string,
  fromIndex: number
): number {
  if (fromIndex >= content.length) return fromIndex;

  const region = content.slice(fromIndex);

  // Scan for boundaries in priority order
  // 1. Paragraph break (\n\n)
  let bestBoundary = -1;

  // Find the earliest useful boundary
  let searchFrom = 0;
  while (searchFrom < region.length) {
    let boundaryEnd = -1;

    // Check for paragraph break
    const paraIdx = region.indexOf('\n\n', searchFrom);
    if (paraIdx !== -1) {
      boundaryEnd = paraIdx + 2;
    }

    // Check for single newline (lower priority, but accept if no paragraph break)
    const nlIdx = region.indexOf('\n', searchFrom);
    if (nlIdx !== -1 && nlIdx + 1 < region.length) {
      const afterNl = nlIdx + 1;
      const restAfterNl = region.slice(afterNl);

      // Check if what follows is a header or list item (render up through the newline)
      const isStructural =
        /^#{1,6}\s/.test(restAfterNl) ||
        /^[-*]\s/.test(restAfterNl) ||
        /^\d+\.\s/.test(restAfterNl);

      if (isStructural && (boundaryEnd === -1 || afterNl < boundaryEnd)) {
        boundaryEnd = afterNl;
      }

      // Plain newline — accept if it's the only option
      if (boundaryEnd === -1 && nlIdx + 1 > 0) {
        boundaryEnd = nlIdx + 1;
      }
    }

    if (boundaryEnd === -1) break;

    // Check formatting balance up to this boundary
    const candidate = fromIndex + boundaryEnd;
    if (formattingIsBalanced(content.slice(fromIndex, candidate))) {
      bestBoundary = candidate;
      break; // Accept the earliest balanced boundary
    }

    // Unbalanced — skip past this boundary and keep looking
    searchFrom = boundaryEnd;
  }

  if (bestBoundary > fromIndex) return bestBoundary;

  // Stall safety: if too much content has accumulated with no boundary
  const pendingLength = content.length - fromIndex;
  if (pendingLength >= STALL_THRESHOLD) {
    // Walk backwards from end to find last balanced point at a space or newline
    for (let i = content.length; i > fromIndex; i--) {
      const ch = content[i - 1];
      if (ch === ' ' || ch === '\n') {
        if (formattingIsBalanced(content.slice(fromIndex, i))) {
          return i;
        }
      }
    }
    // Last resort: render everything we have
    return content.length;
  }

  // No boundary found yet — caller should poll again
  return fromIndex;
}

/**
 * Find the next safe code chunk boundary.
 * Simpler than text — each line is a chunk. Finds last `\n` after fromIndex.
 * Returns `fromIndex` if no complete line yet — caller should poll again.
 */
export function getCodeChunkBoundary(
  content: string,
  fromIndex: number
): number {
  if (fromIndex >= content.length) return fromIndex;

  // Find the last newline in the available content after fromIndex
  const lastNl = content.lastIndexOf('\n', content.length - 1);
  if (lastNl >= fromIndex) {
    return lastNl + 1; // include the newline
  }

  return fromIndex; // no complete line yet
}
