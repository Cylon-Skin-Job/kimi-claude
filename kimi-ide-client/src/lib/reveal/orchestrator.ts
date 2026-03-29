/**
 * Reveal Orchestrator — shared animation engine for all tool types.
 *
 * This is the render loop. It:
 * 1. Feeds content to the parser as tokens stream in
 * 2. Parser returns complete, transformed chunks into the buffer
 * 3. Pulls the next chunk from the buffer
 * 4. Checks if chunk+1 exists in the buffer:
 *    - Yes → type at FAST speed (1ms per char)
 *    - No  → type at SLOW speed (6ms per char)
 * 5. When chunk is done, check buffer for next
 * 6. When completeRef is true (closing tag) and buffer is empty → done
 *
 * The parser is content-type-specific. The orchestrator is shared.
 */

import { INTER_CHUNK_PAUSE } from '../timing';
import type { ChunkParser, ParsedChunk } from './types';

const SPEED_FAST = 1;  // ms per char
const SPEED_SLOW = 6;  // ms per char
const BATCH_SIZE_FAST = 5;  // chars per tick at fast speed
const POLL_INTERVAL = 30;   // ms to wait when buffer is empty
const FLUSH_TIMEOUT = 150;  // ms before flushing partial content from parser

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Type text character by character, calling onChar after each batch.
 */
async function typeChunk(
  text: string,
  msPerChar: number,
  onChar: (typed: string) => void,
  cancelRef: { current: boolean },
): Promise<void> {
  const batchSize = msPerChar <= SPEED_FAST ? BATCH_SIZE_FAST : 1;
  let i = 0;
  while (i < text.length && !cancelRef.current) {
    const end = Math.min(i + batchSize, text.length);
    onChar(text.slice(i, end));
    i = end;
    if (i < text.length) {
      await sleep(msPerChar);
    }
  }
}

export async function orchestrateReveal(
  contentRef: { current: string },
  setDisplayed: (content: string) => void,
  cancelRef: { current: boolean },
  completeRef: { current: boolean },
  parser: ChunkParser,
): Promise<void> {
  const buffer: ParsedChunk[] = [];
  let bufferCursor = 0;   // next chunk to render
  let charCursor = 0;     // characters rendered so far
  let lastFedLength = 0;  // content length last fed to parser
  let stallStart = 0;     // timestamp when buffer became empty with pending content

  while (!cancelRef.current) {
    // ── Step 1: Feed new content to parser ──
    const content = contentRef.current;
    if (content.length > lastFedLength) {
      const newChunks = parser.feed(content, lastFedLength);
      for (const chunk of newChunks) {
        buffer.push(chunk);
      }
      lastFedLength = content.length;
    }

    // ── Step 2: Is there a chunk ready to render? ──
    if (bufferCursor < buffer.length) {
      stallStart = 0; // reset stall timer when we have chunks
      const chunk = buffer[bufferCursor];
      const nextChunkReady = bufferCursor + 1 < buffer.length;
      const speed = nextChunkReady ? SPEED_FAST : SPEED_SLOW;

      // ── Step 3: Type this chunk ──
      await typeChunk(chunk.text, speed, (typed) => {
        charCursor += typed.length;
        setDisplayed(contentRef.current.slice(0, charCursor));
      }, cancelRef);

      bufferCursor++;

      if (!cancelRef.current) {
        await sleep(INTER_CHUNK_PAUSE);
      }
    } else {
      // ── Step 4: Buffer empty — wait or exit ──

      // If closing tag arrived, flush any trailing content and exit
      if (completeRef.current) {
        // Feed one last time to catch any trailing content without a newline
        const finalContent = contentRef.current;
        if (finalContent.length > lastFedLength) {
          const lastChunks = parser.feed(finalContent, lastFedLength);
          for (const chunk of lastChunks) {
            buffer.push(chunk);
          }
          lastFedLength = finalContent.length;
        }

        // If there's still trailing content the parser held back
        // (no final newline), push it as a final chunk
        if (charCursor < finalContent.length) {
          const tail = finalContent.slice(charCursor);
          if (tail.length > 0) {
            buffer.push({ text: tail });
          }
        }

        // Render any remaining buffered chunks
        while (bufferCursor < buffer.length && !cancelRef.current) {
          const chunk = buffer[bufferCursor];
          await typeChunk(chunk.text, SPEED_SLOW, (typed) => {
            charCursor += typed.length;
            setDisplayed(contentRef.current.slice(0, charCursor));
          }, cancelRef);
          bufferCursor++;
        }

        // Done
        break;
      }

      // ── Step 4b: Flush stalled partial content ──
      // If the parser is holding back content (e.g., no \n yet) and
      // we've been waiting longer than FLUSH_TIMEOUT, force-flush it.
      const hasUnrenderedContent = charCursor < contentRef.current.length;
      if (hasUnrenderedContent && parser.flush) {
        if (stallStart === 0) {
          stallStart = Date.now();
        } else if (Date.now() - stallStart >= FLUSH_TIMEOUT) {
          const flushed = parser.flush(contentRef.current);
          for (const chunk of flushed) {
            buffer.push(chunk);
          }
          stallStart = 0;
          // Skip the sleep — go straight to rendering the flushed chunk
          continue;
        }
      } else {
        stallStart = 0;
      }

      // Not complete yet — wait for more tokens
      await sleep(POLL_INTERVAL);
    }
  }

  // Ensure final content is fully displayed
  setDisplayed(contentRef.current);
}
