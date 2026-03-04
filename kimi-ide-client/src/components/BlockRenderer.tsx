/**
 * Block Renderer
 * 
 * Renders blocks sequentially with proper timing:
 * - fade_in (250ms) → shimmer (500ms cycles) → content → close → shimmer (500ms cycles)
 * - hasNext flag controls advancement
 */

import { useEffect, useState, useRef } from 'react';
import { getQueue } from '../lib/blockQueue';
import type { Block, BlockPhase } from '../lib/blockQueue';

// Timing constants
const TIMING = {
  FADE_IN: 250,
  SHIMMER_CYCLE: 500,
  PRE_CONTENT_PAUSE: 500,
  POST_CONTENT_PAUSE: 500,
  COLLAPSE: 300,
  // 5-2-1 typing cadence
  TYPING_SLOW: 5,   // first 100 chars
  TYPING_MEDIUM: 2, // next 100 chars  
  TYPING_FAST: 1,   // rest
} as const;

interface BlockRendererProps {
  workspace: string;
}

export function BlockRenderer({ workspace }: BlockRendererProps) {
  const queue = getQueue(workspace);
  const [state, setState] = useState(queue.getState());
  
  useEffect(() => {
    return queue.subscribe(setState);
  }, [queue]);
  
  return (
    <div className="block-renderer">
      {state.blocks.map((block, index) => (
        <BlockItem
          key={block.id}
          block={block}
          index={index}
          currentIndex={state.currentIndex}
          phase={state.phase}
          hasNext={state.hasNext}
          shimmerCycle={state.shimmerCycle}
          queue={queue}
        />
      ))}
    </div>
  );
}

interface BlockItemProps {
  block: Block;
  index: number;
  currentIndex: number;
  phase: BlockPhase;
  hasNext: boolean;
  shimmerCycle: number;
  queue: ReturnType<typeof getQueue>;
}

function BlockItem({ block, index, currentIndex, phase, hasNext, shimmerCycle, queue }: BlockItemProps) {
  const isCurrent = index === currentIndex;
  const isPast = index < currentIndex;
  
  // Current block phases
  if (isCurrent) {
    return (
      <CurrentBlock
        block={block}
        phase={phase}
        hasNext={hasNext}
        shimmerCycle={shimmerCycle}
        queue={queue}
      />
    );
  }
  
  // Past blocks - show collapsed
  if (isPast) {
    return <CollapsedBlock block={block} />;
  }
  
  // Future blocks - not rendered yet
  return null;
}

// Current block with animation phases
interface CurrentBlockProps {
  block: Block;
  phase: BlockPhase;
  hasNext: boolean;
  shimmerCycle: number;
  queue: ReturnType<typeof getQueue>;
}

function CurrentBlock({ block, phase, shimmerCycle, queue }: CurrentBlockProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const contentRef = useRef(block.content);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Keep content ref updated
  useEffect(() => {
    contentRef.current = block.content;
  }, [block.content]);
  
  // Handle content typing
  useEffect(() => {
    if (phase === 'content') {
      const typeContent = async () => {
        const fullContent = contentRef.current;
        let i = displayedContent.length;
        
        while (i < fullContent.length) {
          // Determine typing speed
          let delay: number;
          if (i < 100) delay = TIMING.TYPING_SLOW;
          else if (i < 200) delay = TIMING.TYPING_MEDIUM;
          else delay = TIMING.TYPING_FAST;
          
          await new Promise(resolve => {
            typingRef.current = setTimeout(resolve, delay);
          });
          
          i++;
          setDisplayedContent(fullContent.slice(0, i));
        }
        
        // Typing complete
        queue.contentComplete();
      };
      
      if (displayedContent.length < block.content.length) {
        typeContent();
      } else {
        // Already typed, complete immediately
        queue.contentComplete();
      }
    }
    
    return () => {
      if (typingRef.current) {
        clearTimeout(typingRef.current);
      }
    };
  }, [phase, block.content]);
  
  // Render based on phase
  switch (phase) {
    case 'fade_in':
    case 'shimmer':
      return (
        <ShimmerBlock 
          block={block} 
          isFading={phase === 'fade_in'}
          shimmerCycle={shimmerCycle}
        />
      );
      
    case 'pre_content_pause':
    case 'content':
    case 'post_content_pause':
      return (
        <ActiveBlock 
          block={block} 
          displayedContent={displayedContent}
          showContent={phase !== 'pre_content_pause'}
          isTyping={phase === 'content'}
        />
      );
      
    case 'collapse':
      return <CollapsingBlock block={block} />;
      
    case 'post_close_shimmer':
      return (
        <ShimmerBlock 
          block={block} 
          shimmerCycle={shimmerCycle}
        />
      );
      
    default:
      return null;
  }
}

// Shimmer phase block
interface ShimmerBlockProps {
  block: Block;
  isFading?: boolean;
  shimmerCycle: number;
}

function ShimmerBlock({ block, isFading, shimmerCycle }: ShimmerBlockProps) {
  const opacity = isFading ? 0.5 : Math.min(1, 0.3 + (shimmerCycle * 0.1));
  
  return (
    <div 
      className={`block-shimmer ${block.type}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        opacity,
        transition: `opacity ${TIMING.FADE_IN}ms ease`,
        marginLeft: block.type === 'think' ? '8px' : '0',
      }}
    >
      {block.header && (
        <>
          <span 
            className="material-symbols-outlined"
            style={{ 
              fontSize: '16px',
              color: 'var(--theme-primary)',
              opacity: 0.8,
            }}
          >
            {block.header.icon}
          </span>
          <span 
            className="shimmer-text"
            style={{ fontSize: '13px' }}
          >
            {block.header.label}
          </span>
        </>
      )}
    </div>
  );
}

// Active block with content
interface ActiveBlockProps {
  block: Block;
  displayedContent: string;
  showContent: boolean;
  isTyping: boolean;
}

function ActiveBlock({ block, displayedContent, showContent, isTyping }: ActiveBlockProps) {
  const isThink = block.type === 'think';
  
  return (
    <div 
      className={`block-active ${block.type}`}
      style={{
        marginBottom: '12px',
        marginLeft: isThink ? '8px' : '0',
      }}
    >
      {/* Header */}
      {block.header && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 0',
          marginBottom: showContent ? '8px' : '0',
        }}>
          <span 
            className="material-symbols-outlined"
            style={{ 
              fontSize: '16px',
              color: 'var(--theme-primary)',
            }}
          >
            {block.header.icon}
          </span>
          <span style={{ 
            fontSize: '13px',
            color: 'var(--text-dim)',
            fontStyle: isThink ? 'italic' : 'normal',
          }}>
            {block.header.label}
          </span>
        </div>
      )}
      
      {/* Content */}
      {showContent && (
        <div style={{
          marginLeft: isThink ? '24px' : '0',
          paddingLeft: isThink ? '12px' : '0',
          borderLeft: isThink ? '2px solid var(--theme-primary)' : 'none',
        }}>
          <div style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: 'var(--text-white)',
            fontStyle: isThink ? 'italic' : 'normal',
            whiteSpace: 'pre-wrap',
          }}>
            {displayedContent}
            {isTyping && (
              <span className="typing-cursor">▋</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Collapsing block
interface CollapsingBlockProps {
  block: Block;
}

function CollapsingBlock({ block }: CollapsingBlockProps) {
  const isThink = block.type === 'think';
  return (
    <div 
      className="block-collapsing"
      style={{
        marginBottom: '12px',
        marginLeft: isThink ? '8px' : '0',
        maxHeight: '0px',
        opacity: 0,
        overflow: 'hidden',
        transition: `max-height ${TIMING.COLLAPSE}ms ease, opacity ${TIMING.COLLAPSE}ms ease`,
      }}
    >
      {/* Collapsed content */}
    </div>
  );
}

// Collapsed block (completed)
interface CollapsedBlockProps {
  block: Block;
}

function CollapsedBlock({ block }: CollapsedBlockProps) {
  const isThink = block.type === 'think';
  return (
    <div 
      className={`block-collapsed ${block.type}`}
      style={{
        marginBottom: '8px',
        marginLeft: isThink ? '8px' : '0',
      }}
    >
      {block.header && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 0',
        }}>
          <span 
            className="material-symbols-outlined"
            style={{ fontSize: '14px', opacity: 0.6 }}
          >
            {block.header.icon}
          </span>
          <span style={{ 
            fontSize: '12px',
            color: 'var(--text-dim)',
          }}>
            {block.header.label}
          </span>
        </div>
      )}
    </div>
  );
}
