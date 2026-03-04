/**
 * Simple Block Renderer — Sequential Gating
 *
 * Only one block animates at a time. Blocks are mounted in order as each
 * becomes the active block. When a block's full lifecycle (including pauses)
 * completes, it calls queue.advanceBlock() to hand off to the next.
 *
 * Block types:
 *   - OrbBlock: pulsing animation → advanceBlock + removeBlock (disappears)
 *   - CollapsibleBlock: shimmer → type 5-2-1 → collapse → advanceBlock (stays as header)
 *   - TextBlock: chase-type → 500ms pause → advanceBlock (stays with content)
 *   - CodeBlock: chase-type → hljs → advanceBlock (stays with highlighted code)
 *   - InlineToolBlock: fade in → shimmer → advanceBlock (stays static)
 */

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { getQueue } from '../lib/simpleQueue';
import { getSegmentCategory } from '../lib/instructions';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import type { Block, SimpleQueue, QueueState } from '../lib/simpleQueue';

// Register hljs languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

// Configure marked for synchronous rendering
marked.setOptions({ async: false });

// Timing constants
const TIMING = {
  ORB_PAUSE_BEFORE: 500,
  ORB_EXPAND: 500,
  ORB_PAUSE_OPEN: 500,
  ORB_CONTRACT: 500,
  ORB_PAUSE_AFTER: 500,
  ORB_FADE: 200,

  FADE_IN: 300,
  SHIMMER_PAUSE: 500,
  TYPING_SLOW: 5,    // chars 0-50
  TYPING_MEDIUM: 2,  // chars 50-100
  TYPING_FAST: 1,    // chars 100+
  POST_TYPE_PAUSE: 500,
  COLLAPSE: 500,
  POST_COLLAPSE_PAUSE: 500,

  INLINE_FADE_IN: 250,
  INLINE_SHIMMER: 500,
} as const;

interface SimpleBlockRendererProps {
  workspace: string;
}

export function SimpleBlockRenderer({ workspace }: SimpleBlockRendererProps) {
  const queue = getQueue(workspace);
  const [state, setState] = useState<QueueState>(() => queue.getState());

  useEffect(() => {
    return queue.subscribe((s) => setState({ ...s }));
  }, [queue, workspace]);

  const { blocks, activeBlockId } = state;

  // Only mount blocks up to and including the active one.
  // If activeBlockId is null, all blocks are lifecycle-complete — show all.
  let visibleCount: number;
  if (activeBlockId === null) {
    visibleCount = blocks.length;
  } else {
    const activeIdx = blocks.findIndex(b => b.id === activeBlockId);
    visibleCount = activeIdx >= 0 ? activeIdx + 1 : blocks.length;
  }

  const visibleBlocks = blocks.slice(0, visibleCount);

  return (
    <div className="simple-block-renderer">
      {visibleBlocks.map((block) => (
        <BlockItem
          key={block.id}
          block={block}
          queue={queue}
          isActive={block.id === activeBlockId}
        />
      ))}
    </div>
  );
}

interface BlockItemProps {
  block: Block;
  queue: SimpleQueue;
  isActive: boolean;
}

const BlockItem = memo(function BlockItem({ block, queue, isActive }: BlockItemProps) {
  switch (block.type) {
    case 'orb':
      return <OrbBlock block={block} queue={queue} isActive={isActive} />;
    case 'think':
      return <CollapsibleBlock block={block} queue={queue} isActive={isActive} />;
    case 'text':
      return <TextBlock block={block} queue={queue} isActive={isActive} />;
    case 'code':
      return <CodeBlock block={block} queue={queue} isActive={isActive} />;
    case 'tool': {
      const segType = block.meta?.segmentType || '';
      const category = getSegmentCategory(segType);
      if (category === 'collapsible') {
        return <CollapsibleBlock block={block} queue={queue} isActive={isActive} />;
      }
      return <InlineToolBlock block={block} queue={queue} isActive={isActive} />;
    }
    default:
      return null;
  }
}, (prev, next) => {
  // Only re-render when isActive changes (block ref is mutable, always same object)
  return prev.isActive === next.isActive && prev.block.id === next.block.id;
});

// ─── ORB BLOCK ──────────────────────────────────────────────
// Full lifecycle → advanceBlock() + removeBlock() (disappears)

function OrbBlock({ block, queue }: BlockItemProps) {
  const [phase, setPhase] = useState(0);
  const phases = [
    { name: 'pause-before', duration: 500 },
    { name: 'fade-in',      duration: 200 },
    { name: 'expand',       duration: 500 },
    { name: 'hold',         duration: 600 },  // dwell at peak
    { name: 'contract',     duration: 500 },
    { name: 'fade-out',     duration: 200 },
    { name: 'pause-after',  duration: 500 },
  ];

  useEffect(() => {
    if (phase >= phases.length) {
      queue.advanceBlock();
      queue.removeBlock(block.id);
      return;
    }

    const timer = setTimeout(() => {
      setPhase(p => p + 1);
    }, phases[phase].duration);

    return () => clearTimeout(timer);
  }, [phase]);

  if (phase >= phases.length) return null;

  const currentPhase = phases[phase].name;

  // Style targets per phase
  let opacity = 0;
  let transform = 'scale(0)';
  let filter = 'blur(0px)';
  let transitionDuration = '500ms';

  switch (currentPhase) {
    case 'pause-before':
      opacity = 0; transform = 'scale(0)'; transitionDuration = '0ms'; break;
    case 'fade-in':
      opacity = 1; transform = 'scale(0.6)'; transitionDuration = '200ms'; break;
    case 'expand':
      opacity = 1; transform = 'scale(1.2)'; filter = 'blur(2px)'; transitionDuration = '500ms'; break;
    case 'hold':
      opacity = 1; transform = 'scale(1.2)'; filter = 'blur(2px)'; transitionDuration = '0ms'; break;
    case 'contract':
      opacity = 1; transform = 'scale(0)'; filter = 'blur(0px)'; transitionDuration = '500ms'; break;
    case 'fade-out':
      opacity = 0; transform = 'scale(0)'; transitionDuration = '200ms'; break;
    case 'pause-after':
      opacity = 0; transform = 'scale(0)'; transitionDuration = '0ms'; break;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '4px 0',
      marginLeft: '5px',
      marginTop: '20px',
      height: currentPhase === 'pause-before' || currentPhase === 'pause-after' ? '0px' : 'auto',
      overflow: 'hidden',
      transition: `height 200ms ease`,
    }}>
      {/* 24px icon slot — matches CollapsibleBlock header icon slot */}
      <span
        className="material-symbols-outlined"
        style={{
          width: '24px',
          textAlign: 'center',
          fontSize: '24px',
          color: 'var(--theme-primary)',
          opacity,
          transform,
          filter,
          transition: `all ${transitionDuration} ease-in-out`,
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        lens_blur
      </span>
    </div>
  );
}

// ─── COLLAPSIBLE BLOCK (think / shell / write) ────────────────────
// Shimmer → type 5-2-1 → collapse → advanceBlock (stays as collapsed header)

function CollapsibleBlock({ block, queue }: BlockItemProps) {
  const [phase, setPhase] = useState<
    'shimmer' | 'pre-type-pause' | 'typing' | 'post-type-pause' | 'collapsing' | 'collapsed'
  >('shimmer');
  const [displayedContent, setDisplayedContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [iconVisible, setIconVisible] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const [shimmerActive, setShimmerActive] = useState(false);
  const typingCancelRef = useRef(false);
  const advancedRef = useRef(false);

  const liveBlock = useRef(block);
  useEffect(() => { liveBlock.current = block; }, [block]);

  // Staggered reveal: icon (300ms fade) → 500ms wait → label+shimmer appear
  // Shimmer runs 1000ms, then 500ms pause, then typing begins
  useEffect(() => {
    requestAnimationFrame(() => setIconVisible(true));

    // 800ms: label + shimmer appear
    const labelTimer = setTimeout(() => {
      setLabelVisible(true);
      setShimmerActive(true);
    }, 800);

    // 2300ms: shimmer stops (800 + 1500ms shimmer), enter pause before typing
    const shimmerTimer = setTimeout(() => {
      setShimmerActive(false);
      setPhase('pre-type-pause');
    }, 2300);

    // 2800ms: start typing
    const typeTimer = setTimeout(() => {
      setPhase('typing');
    }, 2800);

    return () => {
      clearTimeout(labelTimer);
      clearTimeout(shimmerTimer);
      clearTimeout(typeTimer);
    };
  }, []);

  // Typing phase — 5-2-1 cadence
  useEffect(() => {
    if (phase !== 'typing') return;
    typingCancelRef.current = false;

    const typeContent = async () => {
      const fullContent = liveBlock.current.content;
      for (let i = 0; i < fullContent.length; i++) {
        if (typingCancelRef.current) return;

        let delay: number;
        if (i < 50) delay = TIMING.TYPING_SLOW;
        else if (i < 100) delay = TIMING.TYPING_MEDIUM;
        else delay = TIMING.TYPING_FAST;

        await new Promise(resolve => setTimeout(resolve, delay));
        if (typingCancelRef.current) return;
        setDisplayedContent(fullContent.slice(0, i + 1));
      }

      setPhase('post-type-pause');
    };

    typeContent();
    return () => { typingCancelRef.current = true; };
  }, [phase]);

  // Post-type pause → collapsing
  useEffect(() => {
    if (phase === 'post-type-pause') {
      const timer = setTimeout(() => {
        setPhase('collapsing');
        setIsExpanded(false);
      }, TIMING.POST_TYPE_PAUSE);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Collapsing → collapsed + advanceBlock
  useEffect(() => {
    if (phase === 'collapsing') {
      const timer = setTimeout(() => {
        setPhase('collapsed');
        if (!advancedRef.current) {
          advancedRef.current = true;
          queue.advanceBlock();
        }
      }, TIMING.COLLAPSE);
      return () => clearTimeout(timer);
    }
  }, [phase, queue]);

  const isTyping = phase === 'typing';
  const isCollapsed = phase === 'collapsed';

  const toggleExpand = () => {
    if (!isCollapsed) return;
    setIsExpanded(prev => !prev);
  };

  return (
    <div style={{
      marginTop: '20px',
      marginBottom: '12px',
    }}>
      <div
        onClick={toggleExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 0',
          marginBottom: isExpanded ? '8px' : '0',
          cursor: isCollapsed ? 'pointer' : 'default',
        }}
      >
        {/* 24px icon slot — matches OrbBlock icon slot */}
        <span
          className="material-symbols-outlined"
          style={{
            width: '24px',
            textAlign: 'center',
            fontSize: '16px',
            color: 'var(--theme-primary)',
            opacity: iconVisible ? (shimmerActive ? 0.6 : 1) : 0,
            transition: 'opacity 300ms ease-in',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {block.header?.icon || 'lightbulb'}
        </span>
        <span
          className={shimmerActive ? 'shimmer-text' : ''}
          style={{
            fontSize: '13px',
            color: 'var(--text-dim)',
            fontStyle: 'italic',
            opacity: labelVisible ? 1 : 0,
            transition: 'opacity 300ms ease-in',
          }}
        >
          {block.header?.label || 'Thinking'}
        </span>
        {/* Toggle arrow — appears after collapse, right next to label */}
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: '14px',
            color: 'var(--text-dim)',
            opacity: isCollapsed ? 1 : 0,
            transition: 'opacity 300ms ease, transform 200ms ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            marginLeft: '-4px',
            position: 'relative',
            top: '2px',
          }}
        >
          arrow_right
        </span>
      </div>

      <div style={{
        marginLeft: '11px',
        paddingLeft: '21px',
        borderLeft: `1px solid ${isTyping || phase === 'post-type-pause' || phase === 'collapsing' || phase === 'collapsed' ? 'var(--theme-primary)' : 'transparent'}`,
        transition: 'border-color 300ms ease',
        maxHeight: isExpanded ? '2000px' : '0px',
        opacity: isExpanded ? 1 : 0,
        overflow: 'hidden',
        transition: `max-height ${TIMING.COLLAPSE}ms ease, opacity ${TIMING.COLLAPSE}ms ease`,
      }}>
        <div style={{
          fontSize: '14px',
          lineHeight: '1.6',
          color: 'var(--text-dim)',
          fontStyle: block.type === 'think' ? 'italic' : 'normal',
          whiteSpace: 'pre-wrap',
          padding: '8px 0',
        }}>
          {isTyping || phase === 'post-type-pause' || phase === 'collapsing' || phase === 'collapsed'
            ? displayedContent
            : ''}
          {isTyping && <span className="typing-cursor">&#9611;</span>}
        </div>
      </div>
    </div>
  );
}

// ─── TEXT BLOCK ──────────────────────────────────────────────
// Chase-type → 500ms pause → advanceBlock (stays with content)

function TextBlock({ block, queue }: BlockItemProps) {
  const [charIndex, setCharIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const typingCancelRef = useRef(false);
  const advancedRef = useRef(false);
  const liveBlock = useRef(block);

  useEffect(() => { liveBlock.current = block; }, [block]);

  // Chase-typing effect
  useEffect(() => {
    if (isDone) return;
    typingCancelRef.current = false;

    const chase = async () => {
      let idx = charIndex;

      while (true) {
        if (typingCancelRef.current) return;

        const content = liveBlock.current.content;

        if (idx < content.length) {
          let delay: number;
          if (idx < 50) delay = TIMING.TYPING_SLOW;
          else if (idx < 100) delay = TIMING.TYPING_MEDIUM;
          else delay = TIMING.TYPING_FAST;

          await new Promise(resolve => setTimeout(resolve, delay));
          if (typingCancelRef.current) return;
          idx++;
          setCharIndex(idx);
        } else if (liveBlock.current.complete) {
          setIsDone(true);
          return;
        } else {
          await new Promise(resolve => setTimeout(resolve, 16));
        }
      }
    };

    chase();
    return () => { typingCancelRef.current = true; };
  }, [isDone]);

  // Post-typing pause → advanceBlock
  useEffect(() => {
    if (isDone && !advancedRef.current) {
      const timer = setTimeout(() => {
        advancedRef.current = true;
        queue.advanceBlock();
      }, TIMING.POST_TYPE_PAUSE);
      return () => clearTimeout(timer);
    }
  }, [isDone, queue]);

  const displayedText = isDone ? block.content : block.content.slice(0, charIndex);
  const htmlContent = useMemo(() => {
    if (!displayedText) return '';
    return marked.parse(displayedText) as string;
  }, [displayedText]);

  return (
    <div
      className="text-block-content"
      style={{
        fontSize: '14px',
        lineHeight: '1.6',
        color: 'var(--text-white)',
        padding: '0 8px',
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      {!isDone && <span className="typing-cursor">&#9611;</span>}
    </div>
  );
}

// ─── CODE BLOCK ─────────────────────────────────────────────
// Chase-type → hljs highlight → advanceBlock (stays with highlighted code)

function CodeBlock({ block, queue }: BlockItemProps) {
  const [charIndex, setCharIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [highlighted, setHighlighted] = useState('');
  const typingCancelRef = useRef(false);
  const advancedRef = useRef(false);
  const liveBlock = useRef(block);

  useEffect(() => { liveBlock.current = block; }, [block]);

  // Chase-typing for code
  useEffect(() => {
    if (isDone) return;
    typingCancelRef.current = false;

    const chase = async () => {
      let idx = charIndex;

      while (true) {
        if (typingCancelRef.current) return;

        const content = liveBlock.current.content;

        if (idx < content.length) {
          let delay: number;
          if (idx < 50) delay = TIMING.TYPING_SLOW;
          else if (idx < 100) delay = TIMING.TYPING_MEDIUM;
          else delay = TIMING.TYPING_FAST;

          await new Promise(resolve => setTimeout(resolve, delay));
          if (typingCancelRef.current) return;
          idx++;
          setCharIndex(idx);
        } else if (liveBlock.current.complete) {
          setIsDone(true);
          return;
        } else {
          await new Promise(resolve => setTimeout(resolve, 16));
        }
      }
    };

    chase();
    return () => { typingCancelRef.current = true; };
  }, [isDone]);

  // Apply syntax highlighting when typing complete
  useEffect(() => {
    if (isDone && block.content) {
      const lang = block.meta?.language || '';
      try {
        if (lang && hljs.getLanguage(lang)) {
          const result = hljs.highlight(block.content, { language: lang });
          setHighlighted(result.value);
        } else {
          const result = hljs.highlightAuto(block.content);
          setHighlighted(result.value);
        }
      } catch {
        setHighlighted(block.content);
      }
    }
  }, [isDone, block.content, block.meta?.language]);

  // After highlighting applied → advanceBlock
  useEffect(() => {
    if (isDone && highlighted && !advancedRef.current) {
      const timer = setTimeout(() => {
        advancedRef.current = true;
        queue.advanceBlock();
      }, TIMING.POST_TYPE_PAUSE);
      return () => clearTimeout(timer);
    }
  }, [isDone, highlighted, queue]);

  const displayedCode = block.content.slice(0, charIndex);
  const lang = block.meta?.language || '';

  return (
    <div style={{
      margin: '12px 8px',
      borderRadius: '8px',
      overflow: 'hidden',
      background: 'var(--bg-code, #1e1e1e)',
      border: '1px solid var(--theme-border, #333)',
    }}>
      {lang && (
        <div style={{
          padding: '4px 12px',
          fontSize: '11px',
          color: 'var(--text-dim)',
          borderBottom: '1px solid var(--theme-border, #333)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {lang}
        </div>
      )}
      <pre style={{
        margin: 0,
        padding: '12px',
        fontSize: '13px',
        lineHeight: '1.5',
        overflowX: 'auto',
        fontFamily: 'var(--font-mono, "SF Mono", "Fira Code", monospace)',
      }}>
        {isDone && highlighted ? (
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        ) : (
          <code>
            {displayedCode}
            {!isDone && <span className="typing-cursor">&#9611;</span>}
          </code>
        )}
      </pre>
    </div>
  );
}

// ─── INLINE TOOL BLOCK ──────────────────────────────────────
// Fade in → shimmer → settle static → advanceBlock (stays)

function InlineToolBlock({ block, queue }: BlockItemProps) {
  const [iconVisible, setIconVisible] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const [shimmerActive, setShimmerActive] = useState(false);
  const advancedRef = useRef(false);

  useEffect(() => {
    // Icon fades in immediately (300ms ease-in)
    requestAnimationFrame(() => setIconVisible(true));

    // 800ms: label + shimmer appear
    const labelTimer = setTimeout(() => {
      setLabelVisible(true);
      setShimmerActive(true);
    }, 800);

    // 2300ms: shimmer stops (800 + 1500ms shimmer)
    const shimmerTimer = setTimeout(() => {
      setShimmerActive(false);
    }, 2300);

    // 2800ms: advance to next block (500ms pause after shimmer)
    const advanceTimer = setTimeout(() => {
      if (!advancedRef.current) {
        advancedRef.current = true;
        queue.advanceBlock();
      }
    }, 2800);

    return () => {
      clearTimeout(labelTimer);
      clearTimeout(shimmerTimer);
      clearTimeout(advanceTimer);
    };
  }, [block.id, queue]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 0',
      marginTop: '20px',
      marginBottom: '2px',
    }}>
      {/* 24px icon slot — matches CollapsibleBlock */}
      <span
        className="material-symbols-outlined"
        style={{
          width: '24px',
          textAlign: 'center',
          fontSize: '16px',
          color: 'var(--theme-primary)',
          opacity: iconVisible ? (shimmerActive ? 0.6 : 1) : 0,
          transition: 'opacity 300ms ease-in',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {block.header?.icon || 'build'}
      </span>
      <span
        className={shimmerActive ? 'shimmer-text' : ''}
        style={{
          fontSize: '13px',
          color: 'var(--text-dim)',
          fontStyle: 'italic',
          opacity: labelVisible ? 1 : 0,
          transition: 'opacity 300ms ease-in',
        }}
      >
        {block.header?.label || 'Tool'}
      </span>
    </div>
  );
}
