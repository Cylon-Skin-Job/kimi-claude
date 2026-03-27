/**
 * LiveSegmentRenderer — Two-phase rendering for live streaming turns.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ PHASE 1: ORB (gatekeeper)                                  │
 * │                                                             │
 * │ The orb is NOT part of the chat render pipeline.            │
 * │ It runs a fixed 2-second animation (expand → hold →        │
 * │ collapse). When it finishes, it's removed. Only THEN does  │
 * │ Phase 2 begin. This buys 500-800ms of lead time for the    │
 * │ first token to arrive from the API.                         │
 * │                                                             │
 * │ If the API hasn't responded in 2s, we likely have a        │
 * │ connection issue — that's a separate concern.               │
 * ├─────────────────────────────────────────────────────────────┤
 * │ PHASE 2: SEGMENT RENDER                                    │
 * │                                                             │
 * │ Segments animate one at a time:                             │
 * │ 1. ToolCallBlock appears (icon + label shimmer)             │
 * │ 2. Content typing blitz (speed from chunkBuffer)            │
 * │ 3. Post-typing pause                                        │
 * │ 4. Collapse animation                                       │
 * │ 5. Next segment starts                                      │
 * │                                                             │
 * │ Text segments use paragraph/header chunk parsing.           │
 * │ No render engine — self-manages timing.                     │
 * └─────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { markdownToHtml } from '../lib/transforms';
import type { StreamSegment } from '../types';
import { getRenderMode, getSegmentBehavior } from '../lib/segmentCatalog';
import { getReveal } from '../lib/reveal';
import { createChunkBuffer, SPEED_FAST, parseTextChunks } from '../lib/text';
import { ToolCallBlock } from './ToolCallBlock';
import {
  SHIMMER_TOTAL,
  POST_TYPING_PAUSE,
  COLLAPSE_DURATION,
  INTER_SEGMENT_PAUSE,
  INTER_CHUNK_PAUSE,
} from '../lib/timing';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface LiveSegmentRendererProps {
  segments: StreamSegment[];
  onRevealComplete?: () => void;
}

export function LiveSegmentRenderer({ segments, onRevealComplete }: LiveSegmentRendererProps) {
  const [orbDone, setOrbDone] = useState(false);
  const [orbDisposing, setOrbDisposing] = useState(false);
  const disposeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef<Set<number>>(new Set());
  const prevLenRef = useRef(0);
  const hasTokenRef = useRef(false);

  // ── Phase 1: Orb ──
  // Expands over 1s, holds indefinitely, disposes over 500ms when first token arrives.
  useEffect(() => {
    const t = (window as any).__TIMING;
    const now = performance.now();
    if (t) {
      t.orbStartAt = now;
      const sinceS = t.sendAt ? (now - t.sendAt).toFixed(1) : '?';
      console.log(`[TIMING] ORB START at ${now.toFixed(1)}ms — ${sinceS}ms after send`);
    }

    return () => {
      if (disposeTimerRef.current) clearTimeout(disposeTimerRef.current);
    };
  }, []);

  // Watch for first token (segment content appears) → trigger disposal
  useEffect(() => {
    if (hasTokenRef.current || orbDone || orbDisposing) return;

    const hasContent = segments.length > 0 && segments[0].content.length > 0;
    if (hasContent) {
      hasTokenRef.current = true;
      setOrbDisposing(true);

      const t = (window as any).__TIMING;
      if (t) {
        const now = performance.now();
        const sinceSend = t.sendAt ? (now - t.sendAt).toFixed(1) : '?';
        console.log(`[TIMING] ORB DISPOSE START at ${now.toFixed(1)}ms — ${sinceSend}ms after send`);
      }

      disposeTimerRef.current = setTimeout(() => {
        const orbEnd = performance.now();
        const t = (window as any).__TIMING;
        if (t) {
          t.orbEndAt = orbEnd;
          const sinceSend = t.sendAt ? (orbEnd - t.sendAt).toFixed(1) : '?';
          const sinceFirst = t.firstTokenAt ? (orbEnd - t.firstTokenAt).toFixed(1) : '?';
          console.log(`[TIMING] ORB END at ${orbEnd.toFixed(1)}ms — ${sinceSend}ms after send — ${sinceFirst}ms after first token`);
        }
        setOrbDone(true);
      }, 500);
    }
  }, [segments, orbDone, orbDisposing]);

  // ── Phase 2: Segment completion tracking ──
  const onSegmentDone = useCallback((index: number) => {
    doneRef.current.add(index);
    if (onRevealComplete && doneRef.current.size >= segments.length && segments.length > 0) {
      onRevealComplete();
    }
  }, [onRevealComplete, segments.length]);

  useEffect(() => {
    if (segments.length < prevLenRef.current) {
      doneRef.current.clear();
    }
    prevLenRef.current = segments.length;
  }, [segments.length]);

  // ── Render ──

  // Phase 1: Orb is running. Nothing else renders.
  if (!orbDone) {
    return (
      <div style={{ padding: '4px 0' }}>
        <span
          className={`material-symbols-outlined blur-sphere${orbDisposing ? ' disposing' : ''}`}
          style={{
            fontSize: '16px',
            color: 'var(--theme-primary)',
          }}
        >
          lens_blur
        </span>
      </div>
    );
  }

  // Phase 2: Orb is done. Render segments.
  if (!segments || segments.length === 0) {
    return <div className="message-assistant-content streaming" />;
  }

  return (
    <>
      {segments.map((seg, i) => (
        seg.type === 'text' ? (
          <LiveTextSegment
            key={`text-${i}`}
            segment={seg}
            index={i}
            onDone={onSegmentDone}
          />
        ) : (
          <LiveToolSegment
            key={seg.toolCallId || `seg-${i}`}
            segment={seg}
            index={i}
            skipShimmer={i === 0}
            onDone={onSegmentDone}
          />
        )
      ))}
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 2 COMPONENTS — Segment renderers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Live Text Segment ─────────────────────────────────────────────────

interface LiveTextSegmentProps {
  segment: StreamSegment;
  index: number;
  onDone: (index: number) => void;
}

function LiveTextSegment({ segment, index, onDone }: LiveTextSegmentProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [typing, setTyping] = useState(true);
  const animatingRef = useRef(false);
  const contentRef = useRef(segment.content);
  const cursorRef = useRef(0);
  const cancelRef = useRef(false);

  contentRef.current = segment.content;

  useEffect(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    cancelRef.current = false;

    const buffer = createChunkBuffer();
    let totalChunksPushed = 0;

    const animate = async () => {
      let lastParsedLen = 0;

      while (!cancelRef.current) {
        const content = contentRef.current;

        // Re-parse when content grows and push only new chunks
        if (content.length > lastParsedLen) {
          const chunks = parseTextChunks(content);
          for (let c = totalChunksPushed; c < chunks.length; c++) {
            buffer.push({ content: chunks[c] });
            totalChunksPushed++;
          }
          lastParsedLen = content.length;
        }

        if (buffer.hasNext()) {
          const chunk = buffer.next();
          if (chunk) {
            const speedMs = buffer.getSpeedMs();
            await typeText(chunk.content, speedMs, (text) => {
              cursorRef.current += text.length;
              setDisplayedContent(contentRef.current.slice(0, cursorRef.current));
            }, cancelRef);
            await sleep(INTER_CHUNK_PAUSE);
          }
        } else {
          await sleep(30);
          if (cursorRef.current >= contentRef.current.length && contentRef.current.length > 0) {
            break;
          }
        }
      }

      setDisplayedContent(contentRef.current);
      setTyping(false);
      await sleep(INTER_SEGMENT_PAUSE);
      onDone(index);
    };

    animate();
    return () => { cancelRef.current = true; };
  }, []);

  const html = markdownToHtml(displayedContent || '');
  const htmlWithCursor = typing
    ? html + '<span class="typing-cursor">&#x2588;</span>'
    : html;

  return (
    <div
      className="message-assistant-content streaming"
      dangerouslySetInnerHTML={{ __html: htmlWithCursor }}
    />
  );
}

// ── Live Tool Segment ─────────────────────────────────────────────────

interface LiveToolSegmentProps {
  segment: StreamSegment;
  index: number;
  /** Skip shimmer delay — used for first segment after orb (orb already bridged the wait) */
  skipShimmer?: boolean;
  onDone: (index: number) => void;
}

/**
 * LiveToolSegment — Phase controller for non-text segments.
 *
 * This is ONLY the phase state machine. It does NOT know how to
 * reveal content. It dispatches to a reveal sub-module based on
 * renderMode from the catalog.
 *
 * Phases: shimmer → reveal → collapse → done
 *
 * To add a new tool type:
 * 1. Add to segmentCatalog.ts (type, visual, behavior, renderMode)
 * 2. Create reveal module in src/lib/reveal/
 * 3. Register in src/lib/reveal/index.ts
 */
function LiveToolSegment({ segment, index, skipShimmer, onDone }: LiveToolSegmentProps) {
  const [phase, setPhase] = useState<'shimmer' | 'revealing' | 'collapsing' | 'done'>('shimmer');
  const [expanded, setExpanded] = useState(true);
  const [displayedContent, setDisplayedContent] = useState('');
  const animatingRef = useRef(false);
  const contentRef = useRef(segment.content);
  const completeRef = useRef(segment.complete ?? false);
  const cancelRef = useRef(false);

  contentRef.current = segment.content;
  completeRef.current = segment.complete ?? false;

  useEffect(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    cancelRef.current = false;

    const renderMode = getRenderMode(segment.type);
    const reveal = getReveal(renderMode);

    // ── TIMING: Log when this segment's animate() fires ──
    const t = (window as any).__TIMING;
    const mountAt = performance.now();
    if (t) {
      const sinceSend = t.sendAt ? (mountAt - t.sendAt).toFixed(1) : '?';
      const sinceOrbEnd = t.orbEndAt ? (mountAt - t.orbEndAt).toFixed(1) : 'orb not ended?';
      const sinceFirst = t.firstTokenAt ? (mountAt - t.firstTokenAt).toFixed(1) : 'no token yet';
      console.log(`[TIMING] RENDER SIGNAL (${segment.type} #${index}) at ${mountAt.toFixed(1)}ms — ${sinceSend}ms after send — ${sinceOrbEnd}ms after orb end — ${sinceFirst}ms after first token — content length: ${contentRef.current.length}`);
    }

    const animate = async () => {
      // Phase 1: Shimmer (skipped for first segment — orb already bridged the wait)
      if (!skipShimmer) {
        await sleep(SHIMMER_TOTAL);
        if (cancelRef.current) return;
      }

      // Phase 2: Reveal — dispatched to sub-module
      setPhase('revealing');
      if (t) {
        const revealAt = performance.now();
        const sinceSend = t.sendAt ? (revealAt - t.sendAt).toFixed(1) : '?';
        console.log(`[TIMING] REVEAL START (${segment.type} #${index}) at ${revealAt.toFixed(1)}ms — ${sinceSend}ms after send`);
      }
      await reveal.run(contentRef, setDisplayedContent, cancelRef, completeRef);
      if (cancelRef.current) return;

      // Phase 3: Collapse — shimmer off first, then pause, then fold
      setPhase('collapsing');
      await sleep(POST_TYPING_PAUSE);
      setExpanded(false);
      await sleep(COLLAPSE_DURATION);

      // Phase 4: Done
      setPhase('done');
      await sleep(INTER_SEGMENT_PAUSE);
      onDone(index);
    };

    animate();
    return () => { cancelRef.current = true; };
  }, []);

  const behavior = getSegmentBehavior(segment.type);
  const renderMode = getRenderMode(segment.type);

  return (
    <ToolCallBlock
      type={segment.type}
      toolArgs={segment.toolArgs}
      isError={segment.isError}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      shimmer={phase === 'shimmer' || phase === 'revealing'}
    >
      {displayedContent && (
        <div style={{
          whiteSpace: 'pre-wrap',
          fontFamily: behavior.contentFormat === 'code' || behavior.contentFormat === 'diff'
            ? 'monospace' : 'inherit',
          fontStyle: segment.type === 'think' ? 'italic' : 'normal',
        }}>
          {renderMode === 'diff' ? (
            <DiffContent content={displayedContent} />
          ) : (
            displayedContent
          )}
          {phase === 'revealing' && <span className="typing-cursor">&#x2588;</span>}
        </div>
      )}
    </ToolCallBlock>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DiffContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const color = line.startsWith('+') ? '#4ade80'
          : line.startsWith('-') ? '#f87171'
          : undefined;
        const bg = line.startsWith('+') ? 'rgba(74,222,128,0.08)'
          : line.startsWith('-') ? 'rgba(248,113,113,0.08)'
          : undefined;
        return (
          <div key={i} style={{ color, background: bg, fontFamily: 'monospace', fontSize: '13px' }}>
            {line}
          </div>
        );
      })}
    </>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(
  text: string,
  msPerChar: number,
  onProgress: (typed: string) => void,
  cancelRef: React.MutableRefObject<boolean>,
): Promise<void> {
  const batchSize = msPerChar <= SPEED_FAST ? 5 : 1;
  let i = 0;

  while (i < text.length && !cancelRef.current) {
    const end = Math.min(i + batchSize, text.length);
    const batch = text.slice(i, end);
    onProgress(batch);
    i = end;
    if (i < text.length) {
      await sleep(msPerChar);
    }
  }
}
