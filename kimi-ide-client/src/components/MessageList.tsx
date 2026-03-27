/**
 * MessageList — Pure routing.
 *
 * History messages → InstantSegmentRenderer (collapsed, no animation)
 * Current turn     → LiveSegmentRenderer (orb gatekeeper → animated typing)
 */

import { useWorkspaceStore } from '../state/workspaceStore';
import type { Message, AssistantTurn, StreamSegment } from '../types';
import { LiveSegmentRenderer } from './LiveSegmentRenderer';
import { InstantSegmentRenderer } from './InstantSegmentRenderer';

interface MessageListProps {
  workspace: string;
  messages: Message[];
  currentTurn: AssistantTurn | null;
  segments: StreamSegment[];
  lastUserMsgRef?: React.RefObject<HTMLDivElement | null>;
  showOrb?: boolean;
}

export function MessageList({
  workspace,
  messages,
  currentTurn,
  segments,
  lastUserMsgRef,
  showOrb,
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
            <InstantSegmentRenderer segments={msg.segments} />
          )}
        </div>
      ))}

      {(currentTurn || showOrb) && (
        <div className="message message-assistant">
          <LiveSegmentRenderer
            segments={segments}
            onRevealComplete={onRevealComplete}
          />
        </div>
      )}
    </>
  );
}
