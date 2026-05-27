import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

// Keep in sync with backend/main.py:MEMO_MAX.
export const MEMO_MAX = 1000;

interface MemoBlockProps {
  memo: string;
  isMe: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Only provided for the local user's own row; controls memo editing. */
  onChange?: (memo: string) => void;
}

export function MemoBlock({ memo, isMe, expanded, onToggle, onChange }: MemoBlockProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  // When the canonical memo changes from outside (e.g. server echo, or the
  // user navigated to a different room mid-session), reset the draft so the
  // editor reflects current state.
  useEffect(() => {
    if (!editing) setDraft(memo);
  }, [memo, editing]);

  const empty = !memo.trim();
  const previewLine = memo.trim().split('\n')[0] || '';

  function startEdit() {
    setDraft(memo);
    setTab('edit');
    setEditing(true);
  }

  function cancel() {
    setDraft(memo);
    setEditing(false);
  }

  function save() {
    const trimmed = draft.slice(0, MEMO_MAX);
    onChange?.(trimmed);
    setEditing(false);
  }

  // Peer with an empty memo — show nothing.
  if (!isMe && empty && !expanded) return null;

  return (
    <div className={`memo-block${expanded ? ' open' : ''}`}>
      <button type="button" className="memo-head" onClick={onToggle}>
        <span className="memo-glyph" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        <span className="memo-label">on my mind</span>
        {!expanded && !empty && (
          <span className="memo-peek">{previewLine}</span>
        )}
        {!expanded && empty && isMe && (
          <span className="memo-peek memo-peek-empty">tap to write something</span>
        )}
      </button>

      {expanded && !editing && (
        <div className="memo-body">
          {empty ? (
            <div className="memo-empty">nothing here yet.</div>
          ) : (
            <div className="memo-rendered">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{memo}</ReactMarkdown>
            </div>
          )}
          {isMe && onChange && (
            <div className="memo-actions">
              <button type="button" className="text-link" onClick={startEdit}>
                {empty ? 'write' : 'edit'}
              </button>
            </div>
          )}
        </div>
      )}

      {expanded && editing && (
        <div className="memo-body">
          <div className="memo-tabs" role="tablist">
            <button
              type="button"
              className={`memo-tab${tab === 'edit' ? ' selected' : ''}`}
              onClick={() => setTab('edit')}
            >
              edit
            </button>
            <button
              type="button"
              className={`memo-tab${tab === 'preview' ? ' selected' : ''}`}
              onClick={() => setTab('preview')}
            >
              preview
            </button>
          </div>
          {tab === 'edit' ? (
            <textarea
              className="memo-editor"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MEMO_MAX))}
              placeholder="markdown welcome &mdash; **bold**, _italic_, lists, links..."
              autoFocus
              rows={6}
            />
          ) : (
            <div className="memo-rendered">
              {draft.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{draft}</ReactMarkdown>
              ) : (
                <div className="memo-empty">nothing to preview yet.</div>
              )}
            </div>
          )}
          <div className="memo-actions">
            <span className="memo-counter">{draft.length}/{MEMO_MAX}</span>
            <div style={{ flex: 1 }} />
            <button type="button" className="text-link" onClick={cancel}>
              cancel
            </button>
            <button type="button" className="btn compact" onClick={save}>
              save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
