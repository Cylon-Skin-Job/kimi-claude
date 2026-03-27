/**
 * Code Transform — HTML escaping, code block wrapping, future syntax highlighting.
 *
 * Every code→HTML conversion in the app goes through here.
 * Inline code, fenced blocks, tool output, file explorer — all use these.
 */

/**
 * Escape HTML special characters for safe insertion into HTML.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Wrap code content in a styled pre/code block.
 * Used by: write/edit tool segments, file explorer code view.
 */
export function codeBlockHtml(content: string, language?: string): string {
  if (!content) return '';
  const langClass = language ? ` class="language-${language}"` : '';
  return `<pre style="margin:0;overflow-x:auto"><code${langClass}>${escapeHtml(content)}</code></pre>`;
}

/**
 * Wrap content in a pre block with pre-wrap (for plain text that preserves whitespace).
 * Used by: shell output, line-stream tool segments.
 */
export function preWrapHtml(content: string): string {
  if (!content) return '';
  return `<pre style="margin:0;white-space:pre-wrap">${escapeHtml(content)}</pre>`;
}
