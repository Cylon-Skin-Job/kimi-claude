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
import { getRenderMode } from '../lib/segmentCatalog';
import { getReveal } from '../lib/reveal';
import { getToolRenderer } from '../lib/tool-renderers';
import { computeTimingProfile, type TimingProfile } from '../lib/pressure';
import { createChunkBuffer, parseTextChunks } from '../lib/text';
import { getChunkStrategy } from '../lib/chunk-strategies';
import { ToolCallBlock } from './ToolCallBlock';
import { Orb } from './Orb';

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
  const [revealedCount, setRevealedCount] = useState(0);
  const prevLenRef = useRef(0);
  const hasTokenRef = useRef(false);

  // ── Phase 1: Watch for first token → trigger orb disposal ──
  useEffect(() => {
    if (hasTokenRef.current || orbDone) return;

    const hasContent = segments.length > 0 && segments[0].content.length > 0;
    if (hasContent) {
      hasTokenRef.current = true;
      setOrbDisposing(true);
    }
  }, [segments, orbDone]);

  const handleOrbDone = useCallback(() => {
    setOrbDone(true);
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase 2: Sequential segment reveal + completion detection
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //
  // INVARIANT: Segments render ONE AT A TIME. Segment N+1 does
  // not mount until segment N calls onDone. This is enforced by
  // rendering segments.slice(0, revealedCount + 1).
  //
  // INVARIANT: Turn finalization (onRevealComplete → finalizeTurn)
  // fires EXACTLY ONCE, and ONLY when BOTH conditions are true:
  //   1. All segments have been revealed (revealedCount >= segments.length)
  //   2. turn_end has arrived (onRevealComplete is defined)
  //
  // These two events can arrive in EITHER ORDER:
  //   - Stream finishes first → renderer catches up later → effect fires
  //   - Renderer catches up first → turn_end arrives later → effect fires
  //
  // WHY THIS IS AN EFFECT AND NOT IN THE CALLBACK:
  // onSegmentDone is captured by segment components at mount time via
  // useEffect([], ...). If onRevealComplete changes after mount (turn_end
  // arrives mid-animation), the already-mounted segment has a stale closure.
  // An effect watching [revealedCount, segments.length, onRevealComplete]
  // always sees current values — no stale closures possible.
  //
  // KNOWN PAST BUG (DO NOT REINTRODUCE):
  // Checking completion inside onSegmentDone causes a hang when all
  // segments finish BEFORE turn_end arrives. onRevealComplete is undefined
  // at that point, nobody re-triggers the check, turn hangs forever.
  // The effect-based approach re-evaluates on EVERY change to any input.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const finalizedRef = useRef(false);

  // onSegmentDone: ONLY bumps the counter. No completion logic here.
  // Stable callback — no deps, no stale closure risk. Every mounted
  // segment gets the same function reference.
  const onSegmentDone = useCallback((_index: number) => {
    setRevealedCount(prev => prev + 1);
  }, []);

  // Completion detection: reactive effect, not a callback.
  // Fires whenever revealedCount, segments.length, or onRevealComplete changes.
  useEffect(() => {
    if (finalizedRef.current) return;
    if (!onRevealComplete) return;           // turn_end hasn't arrived yet
    if (segments.length === 0) return;       // no segments to reveal
    if (revealedCount < segments.length) return; // still revealing

    // Both conditions met: all revealed AND turn_end received.
    finalizedRef.current = true;
    onRevealComplete();
  }, [revealedCount, segments.length, onRevealComplete]);

  // Reset on turn change (segments shrink = new turn or thread switch)
  useEffect(() => {
    if (segments.length < prevLenRef.current) {
      setRevealedCount(0);
      finalizedRef.current = false;
      skippedRef.current.clear();
    }
    prevLenRef.current = segments.length;
  }, [segments.length]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Pressure gauge — backlog-aware timing attenuation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //
  // backlogRef updates every render with the current distance
  // between the stream frontier and the reveal cursor.
  // getTimingProfile() is a stable function that segments call
  // at each animation pause point to get CURRENT timing values.
  //
  // See lib/pressure.ts for tier definitions and thresholds.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const backlogRef = useRef(0);
  backlogRef.current = segments.length - revealedCount;

  /** Stable getter — segments call this at each decision point. */
  const getTimingProfile = useCallback((): TimingProfile => {
    return computeTimingProfile(backlogRef.current);
  }, []);


  // Snap-to-frontier: when backlog is hopeless, jump ahead.
  // Skipped segments get skipAnimation=true and render instantly.
  const skippedRef = useRef(new Set<number>());

  useEffect(() => {
    const profile = computeTimingProfile(segments.length - revealedCount);
    if (profile.snapToFrontier && !finalizedRef.current) {
      const target = Math.max(0, segments.length - profile.snapKeepLive);
      if (target > revealedCount) {
        for (let i = 0; i < target; i++) {
          skippedRef.current.add(i);
        }
        setRevealedCount(target);
      }
    }
  }, [segments.length, revealedCount]);

  // ── Render ──

  // Phase 1: Orb is running. Nothing else renders.
  if (!orbDone) {
    return <Orb disposing={orbDisposing} onDone={handleOrbDone} />;
  }

  // Phase 2: Orb is done. Render segments sequentially.
  if (!segments || segments.length === 0) {
    return <div className="message-assistant-content streaming" />;
  }

  // Mount only completed segments + the one currently animating
  const visibleCount = revealedCount + 1;

  return (
    <>
      {segments.slice(0, visibleCount).map((seg, i) => (
        seg.type === 'text' ? (
          <LiveTextSegment
            key={`text-${i}`}
            segment={seg}
            index={i}
            skipAnimation={skippedRef.current.has(i)}
            getTimingProfile={getTimingProfile}
            onDone={onSegmentDone}
          />
        ) : (
          <LiveToolSegment
            key={seg.toolCallId || `seg-${i}`}
            segment={seg}
            index={i}
            skipShimmer={i === 0}
            skipAnimation={skippedRef.current.has(i)}
            getTimingProfile={getTimingProfile}
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
  skipAnimation?: boolean;
  getTimingProfile: () => TimingProfile;
  onDone: (index: number) => void;
}

function LiveTextSegment({ segment, index, skipAnimation, getTimingProfile, onDone }: LiveTextSegmentProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [typing, setTyping] = useState(true);
  const animatingRef = useRef(false);
  const contentRef = useRef(segment.content);
  const completeRef = useRef(segment.complete ?? false);
  const cursorRef = useRef(0);
  const cancelRef = useRef(false);

  contentRef.current = segment.content;
  completeRef.current = segment.complete ?? false;

  useEffect(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    cancelRef.current = false;

    // ── Skipped segments render instantly (snap-to-frontier) ──
    if (skipAnimation) {
      setDisplayedContent(contentRef.current);
      setTyping(false);
      setTimeout(() => onDone(index), 0);
      return;
    }

    const strategy = getChunkStrategy(segment.type);
    const buffer = createChunkBuffer({
      codeFenceAsLookahead: strategy.codeFenceAsLookahead ?? true,
    });
    let totalChunksPushed = 0;

    const animate = async () => {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // TEXT TYPING LOOP
      //
      // Chunks = semantic blocks (paragraphs, headers, code
      // fences, lists). Once a chunk starts typing, it types
      // to completion. NO stopping mid-paragraph.
      //
      // Pressure ONLY acts at chunk boundaries:
      //   - instantReveal: bail, show everything
      //   - interChunkPause: pause between paragraphs
      //     (skipped if next paragraph is already buffered)
      //
      // Within-chunk speed is the buffer's domain:
      //   buffer.getSpeedMs() — FAST if next chunk is buffered,
      //   SLOW if not. This is the right granularity.
      //
      // KNOWN PAST BUG (DO NOT REINTRODUCE):
      // Pressure was reaching into per-character speed mid-chunk,
      // which could cause visual stutter. Pressure only controls
      // the pauses BETWEEN chunks and the instantReveal bail.
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let lastParsedLen = 0;

      while (!cancelRef.current) {
        const content = contentRef.current;

        // Re-parse when content grows and push only new chunks.
        // Each chunk is tagged so the speed attenuator knows what
        // counts as real lookahead vs. decoration or partial content:
        //
        //   isCodeBlock: code fences — same "thought" as preceding text
        //   isPartial:   still streaming, no boundary — NOT evidence we're ahead
        //
        // Universal convention: speed only goes FAST when there are
        // 2+ complete, boundary-terminated, non-code-block chunks ahead.
        if (content.length > lastParsedLen) {
          const chunks = parseTextChunks(content);
          for (let c = totalChunksPushed; c < chunks.length; c++) {
            const isCodeBlock = chunks[c].trimStart().startsWith('```');
            const isLast = c === chunks.length - 1;
            // Last chunk is partial if: it's the last one, the segment
            // isn't complete (more content may arrive), and it doesn't
            // end with a newline (no boundary detected by the parser).
            const isPartial = isLast && !completeRef.current && !chunks[c].endsWith('\n');
            buffer.push({ content: chunks[c], isCodeBlock, isPartial });
            totalChunksPushed++;
          }

          // Detect held-back code fence: parseTextChunks consumed less
          // than the full content because a code fence is waiting for
          // its closing ```. Signal the buffer to attenuate speed.
          const totalChunkedChars = chunks.reduce((sum, c) => sum + c.length, 0);
          buffer.setPendingBlock(totalChunkedChars < content.length);

          lastParsedLen = content.length;
        }

        if (buffer.hasNext()) {
          // ── CHUNK BOUNDARY: pressure check ──
          // This is the ONLY place pressure affects text rendering.
          const p = getTimingProfile();
          if (p.instantReveal && contentRef.current.length > 0) {
            break;
          }

          const chunk = buffer.next();
          if (chunk) {
            // Speed: buffer's own lookahead decides. NOT pressure.
            // If next chunk is buffered → FAST. If not → SLOW.
            const speedMs = buffer.getSpeedMs();
            const batchSize = speedMs <= 1 ? 5 : 1;

            // Type entire chunk to completion. No interruption.
            await typeText(chunk.content, speedMs, batchSize, (text) => {
              cursorRef.current += text.length;
              setDisplayedContent(contentRef.current.slice(0, cursorRef.current));
            }, cancelRef);

            // Pause AFTER this chunk — but only if the buffer is empty.
            // If the next paragraph is already cached, go straight to it.
            // The pause is the "breathe" between paragraphs. When we're
            // keeping up, it feels natural. When we're behind, skipping
            // it lets us catch up without compressing within-chunk speed.
            if (!buffer.hasNext() && !cancelRef.current) {
              const pause = getTimingProfile().interChunkPause;
              if (pause > 0) await sleep(pause);
            }
          }
        } else {
          // Buffer empty — wait for more content or exit
          await sleep(30);
          if (cursorRef.current >= contentRef.current.length && contentRef.current.length > 0) {
            break;
          }
          // FLUSH STALL FIX:
          // parseTextChunks holds back trailing content without a boundary.
          // If the segment is complete (turn_end fired, no more tokens) and
          // the buffer is empty but untyped content remains, force-break.
          //
          // KNOWN PAST BUG (DO NOT REINTRODUCE):
          // Without this, the text typing loop spins forever when the last
          // text segment has trailing content without a paragraph boundary.
          if (completeRef.current && cursorRef.current < contentRef.current.length) {
            break;
          }
        }
      }

      setDisplayedContent(contentRef.current);
      setTyping(false);
      const segPause = getTimingProfile().interSegmentPause;
      if (segPause > 0) await sleep(segPause);
      onDone(index);
    };

    animate();
    return () => { cancelRef.current = true; };
  }, []);

  // Inject cursor INSIDE the markdown structure so it renders inline with text.
  // A marker is placed in the raw text before parsing — markdown wraps it
  // into the same element as surrounding content. Then we swap it for the
  // real cursor span in the HTML output.
  const raw = displayedContent || '';
  const html = typing
    ? markdownToHtml(raw + CURSOR_MARKER).replace(
        CURSOR_MARKER,
        '<span class="typing-cursor">&#x2588;</span>'
      )
    : markdownToHtml(raw);

  return (
    <div
      className="message-assistant-content streaming"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Live Tool Segment ─────────────────────────────────────────────────

interface LiveToolSegmentProps {
  segment: StreamSegment;
  index: number;
  /** Skip shimmer delay — used for first segment after orb (orb already bridged the wait) */
  skipShimmer?: boolean;
  skipAnimation?: boolean;
  getTimingProfile: () => TimingProfile;
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
 * Timing is dynamic — getTimingProfile() is called at each phase
 * boundary, returning pressure-adjusted values. If the renderer falls
 * behind the stream, pauses compress and reveals accelerate.
 * See lib/pressure.ts for tier definitions.
 */
function LiveToolSegment({ segment, index, skipShimmer, skipAnimation, getTimingProfile, onDone }: LiveToolSegmentProps) {
  const [phase, setPhase] = useState<'shimmer' | 'revealing' | 'collapsing' | 'done'>('shimmer');
  const [expanded, setExpanded] = useState(true);
  const [displayedContent, setDisplayedContent] = useState('');
  const animatingRef = useRef(false);
  const contentRef = useRef(segment.content);
  const completeRef = useRef(segment.complete ?? false);
  const cancelRef = useRef(false);
  const collapseMsRef = useRef(300); // synced with ToolCallBlock CSS transition

  contentRef.current = segment.content;
  completeRef.current = segment.complete ?? false;

  useEffect(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    cancelRef.current = false;

    // ── Skipped segments render instantly (snap-to-frontier) ──
    if (skipAnimation) {
      setDisplayedContent(contentRef.current);
      setPhase('done');
      setExpanded(false);
      setTimeout(() => onDone(index), 0);
      return;
    }

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
      // Phase 1: Shimmer — query pressure NOW
      if (!skipShimmer) {
        const p = getTimingProfile();
        if (p.shimmerTotal > 0) {
          await sleep(p.shimmerTotal);
          if (cancelRef.current) return;
        }
      }

      // Phase 2: Reveal — pressure only controls structural options.
      // Within-reveal typing speed is the orchestrator's domain (its own
      // lookahead decides FAST vs SLOW). Pressure controls:
      //   - instantReveal: skip typing, show content at once
      //   - interChunkPause: pause between typed lines
      // Per-character speed (speedFast/speedSlow/batchSizeFast) stays
      // with the orchestrator. Same principle as text segments: once
      // a block is committed, the internal speed is not pressure's concern.
      setPhase('revealing');
      if (t) {
        const revealAt = performance.now();
        const sinceSend = t.sendAt ? (revealAt - t.sendAt).toFixed(1) : '?';
        console.log(`[TIMING] REVEAL START (${segment.type} #${index}) at ${revealAt.toFixed(1)}ms — ${sinceSend}ms after send`);
      }
      const revealProfile = getTimingProfile();
      await reveal.run(contentRef, setDisplayedContent, cancelRef, completeRef, {
        interChunkPause: revealProfile.interChunkPause,
        instantReveal: revealProfile.instantReveal,
      });
      if (cancelRef.current) return;

      // Phase 3: Collapse. The reveal is done — content has been
      // shown. Collapse immediately. The sequential gating
      // (revealedCount) ensures the next segment mounts after
      // this one calls onDone.
      setPhase('collapsing');
      const collapseProfile = getTimingProfile();
      collapseMsRef.current = collapseProfile.collapseDuration;
      if (collapseProfile.postTypingPause > 0) await sleep(collapseProfile.postTypingPause);
      setExpanded(false);
      if (collapseProfile.collapseDuration > 0) await sleep(collapseProfile.collapseDuration);

      // Brief gap then mount next — 100ms feels back-to-back
      setPhase('done');
      await sleep(100);
      onDone(index);
    };

    animate();
    return () => { cancelRef.current = true; };
  }, []);

  const renderer = getToolRenderer(segment.type);

  return (
    <ToolCallBlock
      type={segment.type}
      label={renderer.buildTitle(1, segment.toolArgs)}
      toolArgs={segment.toolArgs}
      isError={segment.isError}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      shimmer={phase === 'shimmer' || phase === 'revealing'}
      collapseDuration={collapseMsRef.current}
    >
      {displayedContent && (
        <div
          style={renderer.contentStyle}
          dangerouslySetInnerHTML={{
            __html: phase === 'revealing' && renderer.showCursor
              ? injectCursor(renderer.formatContent(displayedContent, segment.toolArgs))
              : renderer.formatContent(displayedContent, segment.toolArgs),
          }}
        />
      )}
    </ToolCallBlock>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Marker injected into raw text BEFORE markdown parsing.
 * Markdown wraps it into the same inline/block element as surrounding text.
 * After parsing, we replace it with the actual cursor span — so the cursor
 * lives inside the HTML structure, not appended after closing tags.
 */
const CURSOR_MARKER = '\u200BCURSOR\u200B';

const CURSOR_HTML = '<span class="typing-cursor">&#x2588;</span>';

/**
 * Inject cursor inside the last HTML element for tool segments.
 * If no closing tags exist (flat escaped text), just appends.
 * If closing tags exist, injects before the last one so the cursor
 * renders inline with the final content line.
 */
function injectCursor(html: string): string {
  const lastClose = html.lastIndexOf('</');
  if (lastClose === -1) return html + CURSOR_HTML;
  return html.slice(0, lastClose) + CURSOR_HTML + html.slice(lastClose);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(
  text: string,
  msPerChar: number,
  batchSize: number,
  onProgress: (typed: string) => void,
  cancelRef: React.MutableRefObject<boolean>,
): Promise<void> {
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
