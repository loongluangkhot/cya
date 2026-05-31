import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Sheet } from './Sheet';
import { MEMO_MAX } from './MemoBlock';

interface MemoEditorSheetProps {
  open: boolean;
  initial: string;
  onCancel: () => void;
  onSave: (memo: string) => void;
}

export function MemoEditorSheet({ open, initial, onCancel, onSave }: MemoEditorSheetProps) {
  return (
    <Sheet open={open} onClose={onCancel} title="on your mind">
      <Body initial={initial} onCancel={onCancel} onSave={onSave} />
    </Sheet>
  );
}

function Body({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (memo: string) => void;
}) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [draft, setDraft] = useState(initial);

  return (
    <div className="memo-editor-body">
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
          placeholder="what's occupying your head right now? a question, a mood, what you're into…"
          autoFocus
        />
      ) : (
        <div className="memo-rendered memo-editor-preview">
          {draft.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{draft}</ReactMarkdown>
          ) : (
            <div className="memo-empty">nothing to preview yet.</div>
          )}
        </div>
      )}
      <div className="memo-actions memo-editor-actions">
        <span className="memo-counter">{draft.length}/{MEMO_MAX}</span>
        <button type="button" className="text-link" onClick={onCancel}>
          cancel
        </button>
        <button type="button" className="memo-save" onClick={() => onSave(draft.slice(0, MEMO_MAX))}>
          save
        </button>
      </div>
    </div>
  );
}
