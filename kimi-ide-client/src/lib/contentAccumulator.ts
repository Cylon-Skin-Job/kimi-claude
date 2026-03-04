/**
 * Content Accumulator
 *
 * State machine between WebSocket token stream and block queue.
 * Buffers tokens into logical blocks, detects boundaries (fences, headers,
 * type changes), and updates blocks in-place as content grows.
 */

import { getQueue } from './simpleQueue';
import { toolNameToSegmentType, getSegmentCategory, SEGMENT_ICONS } from './instructions';
import type { SimpleQueue } from './simpleQueue';

type AccumulatorState = 'idle' | 'text' | 'thinking' | 'code' | 'tool';

export class ContentAccumulator {
  private state: AccumulatorState = 'idle';
  private queue: SimpleQueue;
  private currentBlockId: string | null = null;
  private contentBuffer = '';

  // Fence detection across token boundaries
  private backtickCount = 0;
  private fenceLanguage = '';
  private inCodeFence = false;
  private lineBuffer = ''; // partial line for boundary detection

  constructor(workspace: string) {
    this.queue = getQueue(workspace);
  }

  /** Handle content (text) tokens from WebSocket */
  handleContent(text: string): void {
    // If we were thinking, complete that block and switch to text
    if (this.state === 'thinking') {
      this.completeCurrentBlock();
    }

    // Process character by character for fence/header detection
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (this.inCodeFence) {
        this.handleCodeChar(ch);
      } else {
        this.handleTextChar(ch);
      }
    }
  }

  /** Handle thinking tokens from WebSocket */
  handleThinking(text: string): void {
    // If we were in text or code, complete that block
    if (this.state === 'text' || this.state === 'code') {
      this.completeCurrentBlock();
    }

    if (this.state !== 'thinking') {
      // Start new thinking block
      this.state = 'thinking';
      this.contentBuffer = '';
      this.currentBlockId = this.queue.addBlock({
        type: 'think',
        content: '',
        header: {
          icon: 'lightbulb',
          label: 'Thinking',
        },
      });
    }

    this.contentBuffer += text;
    this.queue.updateBlockContent(this.currentBlockId!, this.contentBuffer);
  }

  /** Handle tool_call from WebSocket */
  handleToolCall(toolName: string, toolCallId: string, segmentType?: string): void {
    // Complete any active content block
    this.completeCurrentBlock();

    const segType = segmentType || toolNameToSegmentType(toolName);
    const category = getSegmentCategory(segType);
    const iconInfo = SEGMENT_ICONS[segType] || { icon: 'build', label: toolName };

    if (category === 'collapsible') {
      // Collapsible tools (shell, write) get their own block that shimmers until result
      this.state = 'tool';
      this.contentBuffer = '';
      this.currentBlockId = this.queue.addBlock({
        type: 'tool',
        content: '',
        header: {
          icon: iconInfo.icon,
          label: iconInfo.label,
        },
        meta: { segmentType: segType, toolCallId },
      });
    } else {
      // Inline tools (read, edit, glob, grep, etc) — quick flash
      this.state = 'tool';
      this.currentBlockId = this.queue.addBlock({
        type: 'tool',
        content: '',
        complete: true,
        header: {
          icon: iconInfo.icon,
          label: iconInfo.label,
        },
        meta: { segmentType: segType, toolCallId },
      });
      // Reset state — inline tools don't hold state
      this.currentBlockId = null;
      this.state = 'idle';
    }
  }

  /** Handle tool_result from WebSocket */
  handleToolResult(toolCallId: string, output: string, args?: Record<string, unknown>): void {
    // Find the tool block by toolCallId and mark complete with content
    const blocks = this.queue.getState().blocks;
    const toolBlock = blocks.find(
      b => b.meta?.toolCallId === toolCallId && !b.complete
    );

    if (toolBlock) {
      this.queue.updateBlockContent(toolBlock.id, output);
      this.queue.markBlockComplete(toolBlock.id);
    }

    // If current state was tracking this tool, reset
    if (this.state === 'tool' && this.currentBlockId &&
        this.queue.getBlock(this.currentBlockId)?.meta?.toolCallId === toolCallId) {
      this.currentBlockId = null;
      this.state = 'idle';
    }
  }

  /** Handle turn_end from WebSocket */
  handleTurnEnd(): void {
    this.completeCurrentBlock();
    this.state = 'idle';
  }

  /** Reset for new turn */
  reset(): void {
    this.state = 'idle';
    this.currentBlockId = null;
    this.contentBuffer = '';
    this.backtickCount = 0;
    this.fenceLanguage = '';
    this.inCodeFence = false;
    this.lineBuffer = '';
  }

  // --- Private helpers ---

  /** Process a character in text mode (not inside code fence) */
  private handleTextChar(ch: string): void {
    this.lineBuffer += ch;

    // Track backtick sequences
    if (ch === '`') {
      this.backtickCount++;

      if (this.backtickCount === 3) {
        // Opening fence detected!
        // Remove the backticks from the text buffer
        if (this.contentBuffer.length >= 2) {
          // Remove the 2 backticks already added
          this.contentBuffer = this.contentBuffer.slice(0, -2);
          if (this.currentBlockId) {
            this.queue.updateBlockContent(this.currentBlockId, this.contentBuffer);
          }
        }

        // Complete current text block if it has content
        if (this.contentBuffer.trim().length > 0) {
          this.completeCurrentBlock();
        } else if (this.currentBlockId) {
          // Empty text block — remove it
          this.queue.removeBlock(this.currentBlockId);
          this.currentBlockId = null;
        }

        // Enter code fence mode
        this.inCodeFence = true;
        this.backtickCount = 0;
        this.fenceLanguage = '';
        this.contentBuffer = '';
        this.state = 'code';
        // Don't create the code block yet — wait for language line
        return;
      }
    } else {
      if (this.backtickCount > 0 && this.backtickCount < 3) {
        // Not a fence — flush backticks as content
        this.backtickCount = 0;
      }
      this.backtickCount = 0;
    }

    // Check for ## header at start of line (boundary)
    if (ch === '\n') {
      this.lineBuffer = '';
    } else if (this.lineBuffer === '## ' || this.lineBuffer === '# ') {
      // Header detected — complete current text block, start new one
      if (this.state === 'text' && this.currentBlockId) {
        // Put header prefix back but start new block
        const headerPrefix = this.lineBuffer;
        // Remove header prefix from current buffer
        this.contentBuffer = this.contentBuffer.slice(0, -(headerPrefix.length));
        if (this.contentBuffer.trim().length > 0) {
          this.queue.updateBlockContent(this.currentBlockId, this.contentBuffer);
          this.completeCurrentBlock();
        } else {
          this.queue.removeBlock(this.currentBlockId);
          this.currentBlockId = null;
        }
        // Start new text block with header prefix
        this.contentBuffer = headerPrefix;
        this.state = 'idle'; // will be set to 'text' below
      }
    }

    // If no code fence, accumulate text
    if (!this.inCodeFence) {
      this.ensureTextBlock();
      this.contentBuffer += ch;
      this.queue.updateBlockContent(this.currentBlockId!, this.contentBuffer);
    }
  }

  /** Process a character in code mode (inside code fence) */
  private handleCodeChar(ch: string): void {
    // Before code block is created, we're reading the language line
    if (this.state === 'code' && !this.currentBlockId) {
      if (ch === '\n') {
        // Language line complete — create code block
        this.currentBlockId = this.queue.addBlock({
          type: 'code',
          content: '',
          meta: { language: this.fenceLanguage.trim() },
        });
        this.contentBuffer = '';
        return;
      }
      this.fenceLanguage += ch;
      return;
    }

    // Track closing fence
    if (ch === '`') {
      this.backtickCount++;

      if (this.backtickCount === 3) {
        // Closing fence — mark code block complete
        // Remove trailing backticks from content
        if (this.contentBuffer.endsWith('``')) {
          this.contentBuffer = this.contentBuffer.slice(0, -2);
        }
        // Remove trailing newline before fence
        if (this.contentBuffer.endsWith('\n')) {
          this.contentBuffer = this.contentBuffer.slice(0, -1);
        }
        if (this.currentBlockId) {
          this.queue.updateBlockContent(this.currentBlockId, this.contentBuffer);
          this.queue.markBlockComplete(this.currentBlockId);
        }
        this.currentBlockId = null;
        this.contentBuffer = '';
        this.inCodeFence = false;
        this.backtickCount = 0;
        this.state = 'idle';
        this.lineBuffer = '';
        return;
      }
    } else {
      this.backtickCount = 0;
    }

    // Accumulate code content
    this.contentBuffer += ch;
    if (this.currentBlockId) {
      this.queue.updateBlockContent(this.currentBlockId, this.contentBuffer);
    }
  }

  /** Ensure a text block exists, create one if needed */
  private ensureTextBlock(): void {
    if (this.state !== 'text' || !this.currentBlockId) {
      this.state = 'text';
      this.contentBuffer = '';
      this.currentBlockId = this.queue.addBlock({
        type: 'text',
        content: '',
      });
    }
  }

  /** Complete the current block and reset tracking */
  private completeCurrentBlock(): void {
    if (this.currentBlockId) {
      // Final content update
      this.queue.updateBlockContent(this.currentBlockId, this.contentBuffer);
      this.queue.markBlockComplete(this.currentBlockId);
      this.currentBlockId = null;
    }
    this.contentBuffer = '';
    this.backtickCount = 0;
    this.lineBuffer = '';
    this.state = 'idle';
  }
}

// Singleton per workspace
const accumulators: Map<string, ContentAccumulator> = new Map();

export function getAccumulator(workspace: string): ContentAccumulator {
  if (!accumulators.has(workspace)) {
    accumulators.set(workspace, new ContentAccumulator(workspace));
  }
  return accumulators.get(workspace)!;
}
