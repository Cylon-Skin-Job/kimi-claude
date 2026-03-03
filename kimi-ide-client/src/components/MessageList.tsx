import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { Message, AssistantTurn, StreamSegment, WorkspaceId } from '../types';

// Timing constants (ms)
const TIMING = {
  START_PAUSE: 250,
  FADE_IN_START: 250,
  FADE_IN_END: 500,
  SHIMMER_MINIMUM: 1000,
  POST_TYPING_PAUSE: 500,
  COLLAPSE_DURATION: 300,
  INTER_CHUNK_PAUSE: 250,
  TYPING_FAST: 1,
  TYPING_MEDIUM: 2,
  TYPING_SLOW: 5,
} as const;

interface MessageListProps {
  workspace: WorkspaceId;
  messages: Message[];
  currentTurn: AssistantTurn | null;
  segments: StreamSegment[];
}

export function MessageList({ 
  workspace,
  messages, 
  currentTurn, 
  segments,
}: MessageListProps) {
  const engineState = useWorkspaceStore((s) => s.workspaces[workspace].engineState);
  const releasedCount = engineState?.releasedSegmentCount ?? 0;
  const pendingTurnEnd = useWorkspaceStore((s) => s.workspaces[workspace].pendingTurnEnd);
  const finalizeTurn = useWorkspaceStore((s) => s.finalizeTurn);
  const onRevealComplete = pendingTurnEnd ? () => finalizeTurn(workspace) : undefined;
  
  return (
    <>
      {messages.map((msg) => (
        <div key={msg.id} className={`message message-${msg.type}`}>
          {msg.type === 'user' ? (
            <div className="message-user-content">{msg.content}</div>
          ) : (
            <SegmentRenderer 
              segments={msg.segments} 
              isLive={false} 
              releasedCount={msg.segments?.length ?? 0}
            />
          )}
        </div>
      ))}
      
      {currentTurn && (
        <div className="message message-assistant">
          <SegmentRenderer 
            segments={segments} 
            isLive={true} 
            releasedCount={releasedCount}
            onRevealComplete={onRevealComplete}
          />
        </div>
      )}
    </>
  );
}

// ── Segment Renderer ──────────────────────────────────────────────────

interface SegmentRendererProps {
  segments?: StreamSegment[];
  isLive: boolean;
  releasedCount: number;
  onRevealComplete?: () => void;
}

function SegmentRenderer({ segments, isLive, releasedCount, onRevealComplete }: SegmentRendererProps) {
  const doneSegmentsRef = useRef<Set<number>>(new Set());
  
  const onSegmentDone = useCallback((index: number) => {
    if (!onRevealComplete) return;
    doneSegmentsRef.current.add(index);
    const totalRendered = Math.min(releasedCount, segments?.length ?? 0);
    if (totalRendered > 0 && doneSegmentsRef.current.size >= totalRendered) {
      onRevealComplete();
    }
  }, [onRevealComplete, releasedCount, segments?.length]);

  if (!segments || segments.length === 0) {
    return <div className="message-assistant-content streaming" />;
  }

  return (
    <>
      {segments.map((seg, i) => {
        // Gate: only show segments up to releasedCount
        if (isLive && i >= releasedCount) return null;

        // The currently rendering segment is the last released one
        const isLastReleased = isLive && (i === releasedCount - 1);
        
        // Debug
        if (isLive) {
          console.log(`[Render] seg ${i}, releasedCount ${releasedCount}, isLast ${isLastReleased}, type ${seg.type}`);
        }
        const category = getSegmentCategory(seg.type);
        const segmentOnDone = isLastReleased ? () => onSegmentDone(i) : undefined;

        switch (category) {
          case 'collapsible':
            return (
              <CollapsibleChunk
                key={seg.toolCallId || `seg-${i}`}
                segment={seg}
                isLive={isLastReleased}
                onComplete={segmentOnDone}
              />
            );
          case 'inline':
            return (
              <InlineChunk
                key={seg.toolCallId || `seg-${i}`}
                segment={seg}
                isLive={isLastReleased}
                onComplete={segmentOnDone}
              />
            );
          case 'text':
            return (
              <TextChunk
                key={`text-${i}`}
                content={seg.content}
                isLive={isLastReleased}
                onComplete={segmentOnDone}
              />
            );
        }
      })}
    </>
  );
}

// ── Collapsible Chunk (think, shell, write) ───────────────────────────

interface CollapsibleChunkProps {
  segment: StreamSegment;
  isLive: boolean;
  onComplete?: () => void;
}

function CollapsibleChunk({ segment, isLive, onComplete }: CollapsibleChunkProps) {
  const [phase, setPhase] = useState<'idle' | 'shimmer' | 'revealing' | 'complete'>('idle');
  const [expanded, setExpanded] = useState(true);
  const [displayedContent, setDisplayedContent] = useState('');
  const shimmerStartRef = useRef(0);

  // Start animation when this becomes the live segment
  useEffect(() => {
    // Not live? Just show content, no animation
    if (!isLive) {
      setPhase('complete');
      setDisplayedContent(segment.content);
      return;
    }

    // Already animating or done? Don't restart
    if (phase === 'shimmer' || phase === 'revealing') return;
    
    // Start the sequence (handles both fresh start and transition from !isLive)

    // Start the sequence
    setPhase('shimmer');
    
    const runSequence = async () => {
      // Phase 1: Shimmer (minimum 1000ms)
      shimmerStartRef.current = Date.now();
      while (Date.now() - shimmerStartRef.current < TIMING.SHIMMER_MINIMUM) {
        await sleep(50);
      }

      // Phase 3: Reveal content
      setPhase('revealing');
      await typeContent(segment.content, setDisplayedContent);

      // Phase 4: Post-typing pause
      await sleep(TIMING.POST_TYPING_PAUSE);

      // Phase 5: Collapse
      setExpanded(false);
      await sleep(TIMING.COLLAPSE_DURATION);

      // Phase 6: Complete
      setPhase('complete');
      await sleep(TIMING.INTER_CHUNK_PAUSE);
      
      onComplete?.();
    };

    runSequence();
  }, [isLive]); // Only depend on isLive - segment.content updates don't restart

  // Don't render anything until we start
  if (phase === 'idle') {
    return null;
  }

  const icon = segment.icon || getIconForType(segment.type);
  const label = segment.label || segment.type;

  // Calculate shimmer opacity
  const shimmerOpacity = (() => {
    if (phase !== 'shimmer') return 1;
    const elapsed = Date.now() - shimmerStartRef.current;
    if (elapsed < TIMING.FADE_IN_START) return 0;
    if (elapsed < TIMING.FADE_IN_END) {
      return (elapsed - TIMING.FADE_IN_START) / (TIMING.FADE_IN_END - TIMING.FADE_IN_START);
    }
    return 1;
  })();

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Header - always visible once started -->
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 0',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          opacity: phase === 'shimmer' ? shimmerOpacity : 1,
          transition: 'opacity 250ms ease',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
          {icon}
        </span>
        <span 
          className={phase === 'shimmer' ? 'shimmer-text' : ''}
          style={{ fontSize: '14px' }}
        >
          {label}
          <span className="material-symbols-outlined" style={{
            fontSize: '16px',
            verticalAlign: 'middle',
            marginLeft: '2px',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: `transform ${TIMING.COLLAPSE_DURATION}ms ease`,
          }}>
            arrow_drop_down
          </span>
        </span>
      </button>

      {/* Content */}
      <div style={{
        marginLeft: '24px',
        maxHeight: expanded ? '2000px' : '0px',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: `max-height ${TIMING.COLLAPSE_DURATION}ms ease, opacity ${TIMING.COLLAPSE_DURATION}ms ease`,
        ...(segment.type === 'think' ? { borderLeft: '2px solid var(--theme-primary)', paddingLeft: '12px' } : {}),
      }}>
        <div style={{
          padding: '8px 0',
          fontSize: '13px',
          color: 'var(--text-dim)',
          whiteSpace: 'pre-wrap',
          fontFamily: segment.type === 'shell' ? 'monospace' : 'inherit',
          fontStyle: segment.type === 'think' ? 'italic' : 'normal',
        }}>
          {displayedContent}
        </div>
      </div>
    </div>
  );
}

// ── Inline Chunk (read, glob, grep, etc.) ─────────────────────────────

interface InlineChunkProps {
  segment: StreamSegment;
  isLive: boolean;
  onComplete?: () => void;
}

function InlineChunk({ segment, isLive, onComplete }: InlineChunkProps) {
  const [phase, setPhase] = useState<'idle' | 'shimmer' | 'complete'>('idle');
  const shimmerStartRef = useRef(0);

  useEffect(() => {
    if (!isLive) {
      setPhase('complete');
      return;
    }

    if (phase === 'shimmer') return;

    setPhase('shimmer');
    
    const runSequence = async () => {
      shimmerStartRef.current = Date.now();
      while (Date.now() - shimmerStartRef.current < TIMING.SHIMMER_MINIMUM) {
        await sleep(50);
      }

      await sleep(TIMING.POST_TYPING_PAUSE);
      await sleep(TIMING.INTER_CHUNK_PAUSE);
      
      onComplete?.();
    };

    runSequence();
  }, [isLive]);

  if (phase === 'idle') return null;

  const icon = segment.icon || getIconForType(segment.type);
  const label = segment.label || segment.type;

  const shimmerOpacity = (() => {
    if (phase !== 'shimmer') return 1;
    const elapsed = Date.now() - shimmerStartRef.current;
    if (elapsed < TIMING.FADE_IN_START) return 0;
    if (elapsed < TIMING.FADE_IN_END) {
      return (elapsed - TIMING.FADE_IN_START) / (TIMING.FADE_IN_END - TIMING.FADE_IN_START);
    }
    return 1;
  })();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      marginBottom: '4px',
      borderRadius: '6px',
      background: 'rgba(var(--theme-primary-rgb), 0.03)',
      opacity: shimmerOpacity,
      transition: 'opacity 250ms ease',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: '14px', opacity: 0.7 }}>
        {icon}
      </span>
      <span 
        className={phase === 'shimmer' ? 'shimmer-text' : ''}
        style={{ fontSize: '14px', color: 'var(--text-dim)' }}
      >
        {label}
      </span>
      {segment.isError && (
        <span style={{ fontSize: '12px', color: 'var(--error, #ef4444)', marginLeft: 'auto' }}>
          error
        </span>
      )}
    </div>
  );
}

// ── Text Chunk (markdown content) ─────────────────────────────────────

interface TextChunkProps {
  content: string;
  isLive: boolean;
  onComplete?: () => void;
}

function TextChunk({ content, isLive, onComplete }: TextChunkProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [phase, setPhase] = useState<'idle' | 'shimmer' | 'revealing' | 'complete'>('idle');
  const shimmerStartRef = useRef(0);

  useEffect(() => {
    if (!isLive) {
      setPhase('complete');
      setDisplayedContent(content);
      return;
    }

    if (phase === 'shimmer' || phase === 'revealing') return;

    setPhase('shimmer');
    
    const runSequence = async () => {
      shimmerStartRef.current = Date.now();
      while (Date.now() - shimmerStartRef.current < TIMING.SHIMMER_MINIMUM) {
        await sleep(50);
      }

      setPhase('revealing');
      await typeContent(content, setDisplayedContent);

      await sleep(TIMING.POST_TYPING_PAUSE);
      await sleep(TIMING.INTER_CHUNK_PAUSE);
      
      onComplete?.();
    };

    runSequence();
  }, [isLive, content]);

  if (phase === 'idle') return null;

  const shimmerOpacity = (() => {
    if (phase !== 'shimmer') return 1;
    const elapsed = Date.now() - shimmerStartRef.current;
    if (elapsed < TIMING.FADE_IN_START) return 0;
    if (elapsed < TIMING.FADE_IN_END) {
      return (elapsed - TIMING.FADE_IN_START) / (TIMING.FADE_IN_END - TIMING.FADE_IN_START);
    }
    return 1;
  })();

  const html = marked.parse(displayedContent) as string;

  return (
    <div 
      className="message-assistant-content streaming"
      style={{
        opacity: shimmerOpacity,
        transition: 'opacity 250ms ease',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

async function typeContent(
  fullContent: string, 
  setContent: (s: string) => void
): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;
    
    const typeNext = () => {
      if (index >= fullContent.length) {
        resolve();
        return;
      }
      
      index++;
      setContent(fullContent.slice(0, index));
      
      const delay = index < 100 ? TIMING.TYPING_SLOW : index < 200 ? TIMING.TYPING_MEDIUM : TIMING.TYPING_FAST;
      
      setTimeout(typeNext, delay);
    };
    
    typeNext();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSegmentCategory(segmentType: string): 'collapsible' | 'inline' | 'text' {
  if (segmentType === 'text') return 'text';
  if (segmentType === 'think' || segmentType === 'shell' || segmentType === 'write') {
    return 'collapsible';
  }
  return 'inline';
}

function getIconForType(segmentType: string): string {
  const icons: Record<string, string> = {
    think: 'lightbulb',
    shell: 'terminal',
    read: 'description',
    write: 'edit_note',
    edit: 'find_replace',
    glob: 'folder_search',
    grep: 'search',
    web_search: 'travel_explore',
    fetch: 'link',
    subagent: 'smart_toy',
    todo: 'checklist',
  };
  return icons[segmentType] || 'build';
}
