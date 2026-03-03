/**
 * Split markdown by ## headers (h2) into blocks.
 * Block 0 = content before first ##. Block 1+ = each ## header and its chunk.
 * Used for block-based pacing: orb before each header, sequential beats.
 */
export function parseMarkdownBlocks(content: string): string[] {
  if (!content.trim()) return [];
  const parts = content.split(/(?=^## )/m);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function isHeaderBlock(block: string): boolean {
  return block.startsWith('## ');
}
