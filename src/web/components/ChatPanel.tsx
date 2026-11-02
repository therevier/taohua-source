import { useEffect, useRef, useState } from 'react';
import type { ChatTurn } from '../../shared/types';

export function ChatPanel({
  turns,
  sending,
  pendingUser,
  streamingText,
  onSend,
}: {
  turns: ChatTurn[];
  sending: boolean;
  pendingUser: string | null;
  streamingText: string;
  onSend: (message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, sending, streamingText.length, pendingUser]);

  async function submit() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    await onSend(text);
  }

  return (
    <aside className="chat">
      <div className="chat-title">🌸 老师</div>
      <div className="chat-list" ref={listRef}>
        {turns.length === 0 && !pendingUser && (
          <div className="chat-empty">老师马上就来。有问题随时问——老师会一步步带着你，而不是替你写。</div>
        )}
        {turns.map((turn, index) => (
          <div key={`${turn.at}-${index}`} className={`bubble ${turn.role}`}>
            {turn.level ? <span className="level-badge">L{turn.level}</span> : null}
            <div className="bubble-content">{turn.content}</div>
          </div>
        ))}
        {pendingUser && (
          <div className="bubble student">
            <div className="bubble-content">{pendingUser}</div>
          </div>
        )}
        {sending &&
          (streamingText ? (
            <div className="bubble tutor">
              <div className="bubble-content">
                {streamingText}
                <span className="caret" />
              </div>
            </div>
          ) : (
            <div className="bubble tutor typing">老师正在思考…</div>
          ))}
      </div>
      <div className="chat-input">
        <textarea
          value={draft}
          placeholder="向老师提问（Enter 发送，Shift+Enter 换行）"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={3}
        />
        <button
          className="btn primary"
          onClick={() => void submit()}
          disabled={sending || draft.trim().length === 0}
        >
          发送
        </button>
      </div>
    </aside>
  );
}
