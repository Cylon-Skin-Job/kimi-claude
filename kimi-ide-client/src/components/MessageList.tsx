import { useState, useEffect } from 'react';
import { marked } from 'marked';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { Message, AssistantTurn, StreamSegment, WorkspaceId } from '../types';
import {
  getSegmentIcon,
  getSegmentLabelColor,
  buildSegmentLabelWithError,
  getSegmentVisual,
} from '../lib/segmentCatalog';

const COLLAPSE_DURATION = 300; // ms

interface MessageListProps {
  workspace: WorkspaceId;
  messages: Message[];
  currentTurn: AssistantTurn | null;
  segments: StreamSegment[];
  lastUserMsgRef?: React.RefObject<HTMLDivElement | null>;
}

export function MessageList({
  workspace,
  messages,
  currentTurn,
  segments,
  lastUserMsgRef,
}: MessageListProps) {
  const pendingTurnEnd = useWorkspaceStore((s) => s.workspaces[workspace].pendingTurnEnd);
  const finalizeTurn = useWorkspaceStore((s) => s.finalizeTurn);
  const onRevealComplete = pendingTurnEnd ? () => finalizeTurn(workspace) : undefined;

  // Find the last user message index for scroll anchoring
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'user') { lastUserIdx = i; break; }
  }

  return (
    <>
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          ref={i === lastUserIdx ? lastUserMsgRef : undefined}
          className={`message message-${msg.type}`}
        >
          {msg.type === 'user' ? (
            <div className="message-user-content">{msg.content}</div>
          ) : (
            <SegmentRenderer
              segments={msg.segments}
              isLive={false}
            />
          )}
        </div>
      ))}

      {currentTurn && (
        <div className="message message-assistant">
          <SegmentRenderer
            segments={segments}
            isLive={true}
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
  onRevealComplete?: () => void;
}

function SegmentRenderer({ segments, isLive, onRevealComplete }: SegmentRendererProps) {
  if (!segments || segments.length === 0) {
    return <div className="message-assistant-content streaming" />;
  }

  return (
    <>
      {segments.map((seg, i) => {
        // The last segment during live streaming is the active one
        const isLastLive = isLive && (i === segments.length - 1);
        const segmentOnDone = isLastLive ? onRevealComplete : undefined;

        if (seg.type === 'text') {
          return (
            <TextChunk
              key={`text-${i}`}
              content={seg.content}
              isLive={isLastLive}
              onComplete={segmentOnDone}
            />
          );
        } else {
          return (
            <CollapsibleChunk
              key={seg.toolCallId || `seg-${i}`}
              segment={seg}
              isLive={isLastLive}
              onComplete={segmentOnDone}
            />
          );
        }
      })}
    </>
  );
}

// ── Collapsible Chunk (all non-text segments) ──────────────────────────

interface CollapsibleChunkProps {
  segment: StreamSegment;
  isLive: boolean;
  onComplete?: () => void;
}

function CollapsibleChunk({ segment, isLive, onComplete }: CollapsibleChunkProps) {
  const [expanded, setExpanded] = useState(false);

  // Signal completion for turn-end finalization
  useEffect(() => {
    if (!isLive) return;
    // Complete immediately — animation comes in Phase 2
    onComplete?.();
  }, [isLive]);

  const visual = getSegmentVisual(segment.type);
  const icon = segment.icon || getSegmentIcon(segment.type, segment.isError);
  const label = segment.label || buildSegmentLabelWithError(segment.type, segment.toolArgs, segment.isError);
  const iconColor = segment.isError
    ? (getSegmentIcon(segment.type, true) !== visual.icon ? 'var(--error, #ef4444)' : visual.iconColor)
    : visual.iconColor;
  const labelColor = getSegmentLabelColor(segment.type, segment.isError);

  const hasContent = segment.content.length > 0;

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => hasContent && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 0',
          border: 'none',
          background: 'none',
          cursor: hasContent ? 'pointer' : 'default',
          color: labelColor,
          font: 'inherit',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: `${visual.iconSize}px`, color: iconColor }}>
          {icon}
        </span>
        <span style={{ fontSize: '13px', fontStyle: visual.labelStyle }}>
          {label}
          {hasContent && (
            <span className="material-symbols-outlined" style={{
              fontSize: '16px',
              verticalAlign: 'middle',
              marginLeft: '2px',
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: `transform ${COLLAPSE_DURATION}ms ease`,
            }}>
              arrow_drop_down
            </span>
          )}
        </span>
      </button>

      {/* Content */}
      {hasContent && (
        <div style={{
          marginLeft: '24px',
          maxHeight: expanded ? '2000px' : '0px',
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: `max-height ${COLLAPSE_DURATION}ms ease, opacity ${COLLAPSE_DURATION}ms ease`,
          ...(visual.borderLeft ? {
            borderLeft: `${visual.borderLeft.width} solid ${visual.borderLeft.color}`,
            paddingLeft: '12px'
          } : {}),
        }}>
          <div style={{
            padding: '8px 0',
            fontSize: '13px',
            color: visual.contentColor,
            whiteSpace: 'pre-wrap',
            fontFamily: visual.contentTypography === 'monospace' ? 'monospace' : 'inherit',
            fontStyle: visual.contentTypography === 'italic' ? 'italic' : 'normal',
          }}>
            {segment.content}
          </div>
        </div>
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
  // Signal completion for turn-end finalization
  useEffect(() => {
    if (!isLive) return;
    onComplete?.();
  }, [isLive]);

  if (!content) return null;

  const html = marked.parse(content) as string;

  return (
    <div
      className="message-assistant-content streaming"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
