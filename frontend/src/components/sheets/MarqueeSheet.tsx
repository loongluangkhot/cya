import { useState } from 'react';
import { Sheet } from './Sheet';
import Icon from '../Icon';
import { API_BASE } from '../../api';
import type { MarqueeFeed, MarqueeItem } from '../../types';

interface MarqueeSheetProps {
  open: boolean;
  onClose: () => void;
  optIn: boolean;
  onToggleOptIn: () => void;
  stripOn: boolean;
  onToggleStrip: () => void;
  roomFeeds: MarqueeFeed[];
  userFeeds: MarqueeFeed[];
  mutedSources: string[];
  onToggleMute: (url: string) => void;
  onAddRoomFeed: (url: string) => void;
  onRemoveRoomFeed: (url: string) => void;
  onAddUserFeed: (feed: MarqueeFeed) => boolean;
  onRemoveUserFeed: (url: string) => void;
  mergedItems: MarqueeItem[];
  /** Currently-selected article id; null = sources/headlines view. */
  articleId: string | null;
  onOpenArticle: (id: string) => void;
  onCloseArticle: () => void;
  feedTitle: (url: string) => string;
}

type AddTarget = 'room' | 'user';

function formatDate(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function formatFullDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function MarqueeSheet(props: MarqueeSheetProps) {
  const {
    open,
    onClose,
    optIn,
    onToggleOptIn,
    stripOn,
    onToggleStrip,
    roomFeeds,
    userFeeds,
    mutedSources,
    onToggleMute,
    onAddRoomFeed,
    onRemoveRoomFeed,
    onAddUserFeed,
    onRemoveUserFeed,
    mergedItems,
    articleId,
    onOpenArticle,
    onCloseArticle,
    feedTitle,
  } = props;

  const [addUrl, setAddUrl] = useState('');
  const [addTarget, setAddTarget] = useState<AddTarget>('room');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const mutedSet = new Set(mutedSources);

  async function onAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (addBusy) return;
    const url = addUrl.trim();
    if (!url) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch(`${API_BASE}/api/marquee/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        setAddError("couldn't reach that feed");
        return;
      }
      const data = (await res.json()) as { url: string; title?: string };
      if (addTarget === 'room') {
        onAddRoomFeed(data.url);
      } else {
        const ok = onAddUserFeed({ url: data.url, title: data.title ?? '', added_by: null });
        if (!ok) {
          setAddError('feed already added or limit reached');
          return;
        }
      }
      setAddUrl('');
    } catch {
      setAddError("couldn't reach that feed");
    } finally {
      setAddBusy(false);
    }
  }

  const headerAction = (
    <>
      <button
        type="button"
        className={`sheet-toggle${optIn ? ' on' : ''}`}
        onClick={onToggleOptIn}
        aria-pressed={optIn}
        aria-label={optIn ? 'turn marquee off' : 'turn marquee on'}
      >
        {optIn ? 'on' : 'off'}
      </button>
      <button
        type="button"
        className={`sheet-icon-toggle${optIn && stripOn ? ' on' : ''}`}
        onClick={onToggleStrip}
        aria-pressed={stripOn}
        aria-label={stripOn ? 'hide the strip' : 'show the strip'}
        title={stripOn ? 'hide the strip' : 'show the strip'}
        disabled={!optIn}
      >
        <Icon name="screen" size={12} />
      </button>
    </>
  );

  if (!optIn) {
    return (
      <Sheet open={open} onClose={onClose} title="marquee" tall headerAction={headerAction}>
        <div className="sheet-gate">
          <div className="sheet-gate-mark" aria-hidden="true">⌬</div>
          <div className="h-display" style={{ fontSize: 20, marginBottom: 8 }}>
            turn on the marquee
          </div>
          <div className="body-text" style={{ marginBottom: 18, maxWidth: 280 }}>
            a quiet ticker of headlines runs along the top of the room. add your
            own RSS feeds; mute the ones you don&apos;t want to see.
          </div>
          <button type="button" className="btn compact" onClick={onToggleOptIn}>
            turn on
          </button>
        </div>
      </Sheet>
    );
  }

  // ─── Article detail view ─────────────────────────
  if (articleId) {
    const article = mergedItems.find((i) => i.id === articleId) ?? null;
    return (
      <Sheet open={open} onClose={onClose} title="marquee" tall headerAction={headerAction}>
        <div className="marquee-article">
          <button type="button" className="marquee-back" onClick={onCloseArticle}>
            ← all headlines
          </button>
          {article ? (
            <>
              <div className="marquee-article-source">{feedTitle(article.feed_url)}</div>
              <div className="marquee-article-title">{article.title}</div>
              {article.published_at > 0 && (
                <div className="marquee-article-date">{formatFullDate(article.published_at)}</div>
              )}
              {article.description && (
                <div className="marquee-article-body">{article.description}</div>
              )}
              {article.link && (
                <a
                  className="btn compact marquee-article-link"
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  open original ↗
                </a>
              )}
            </>
          ) : (
            <div className="body-text">that headline has rolled off the marquee.</div>
          )}
        </div>
      </Sheet>
    );
  }

  // ─── Sources + headlines view ─────────────────────────
  return (
    <Sheet open={open} onClose={onClose} title="marquee" tall headerAction={headerAction}>
      <div className="marquee-layout">
        <section className="marquee-sources">
          <div className="marquee-section-label h-mono">in this room</div>
          {roomFeeds.length === 0 && (
            <div className="marquee-empty body-text">no feeds yet — add one below.</div>
          )}
          {roomFeeds.map((f) => (
            <FeedRow
              key={f.url}
              feed={f}
              displayTitle={feedTitle(f.url)}
              muted={mutedSet.has(f.url)}
              onToggleMute={() => onToggleMute(f.url)}
              onRemove={() => onRemoveRoomFeed(f.url)}
              attribution={f.added_by ? '(shared)' : ''}
            />
          ))}

          <div className="marquee-section-label h-mono">yours</div>
          {userFeeds.length === 0 && (
            <div className="marquee-empty body-text">private feeds you add show up here.</div>
          )}
          {userFeeds.map((f) => (
            <FeedRow
              key={f.url}
              feed={f}
              displayTitle={feedTitle(f.url)}
              muted={mutedSet.has(f.url)}
              onToggleMute={() => onToggleMute(f.url)}
              onRemove={() => onRemoveUserFeed(f.url)}
              attribution=""
            />
          ))}

          <form className="marquee-add" onSubmit={onAddSubmit}>
            <input
              className="composer-input"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              type="url"
              disabled={addBusy}
            />
            <div className="marquee-add-row">
              <div className="marquee-target" role="radiogroup" aria-label="add to">
                <button
                  type="button"
                  className={`marquee-target-btn${addTarget === 'room' ? ' selected' : ''}`}
                  onClick={() => setAddTarget('room')}
                  role="radio"
                  aria-checked={addTarget === 'room'}
                >
                  <span className="marquee-target-dot" aria-hidden="true" />
                  room
                </button>
                <button
                  type="button"
                  className={`marquee-target-btn${addTarget === 'user' ? ' selected' : ''}`}
                  onClick={() => setAddTarget('user')}
                  role="radio"
                  aria-checked={addTarget === 'user'}
                >
                  <span className="marquee-target-dot" aria-hidden="true" />
                  yours
                </button>
              </div>
              <button
                type="submit"
                className="dial-btn selected marquee-add-submit"
                disabled={addBusy || !addUrl.trim()}
              >
                {addBusy ? 'adding…' : 'add feed'}
              </button>
            </div>
            {addError && <div className="composer-error">{addError}</div>}
          </form>
        </section>

        <section className="marquee-headlines">
          <div className="marquee-section-label h-mono">recent</div>
          {mergedItems.length === 0 ? (
            <div className="marquee-empty body-text">no headlines — add a feed or unmute one.</div>
          ) : (
            <ul className="marquee-headline-list">
              {mergedItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="marquee-headline"
                    onClick={() => onOpenArticle(item.id)}
                  >
                    <div className="marquee-headline-title">{item.title}</div>
                    <div className="marquee-headline-meta">
                      <span className="marquee-headline-source">{feedTitle(item.feed_url)}</span>
                      {item.published_at > 0 && (
                        <span className="marquee-headline-date">{formatDate(item.published_at)}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}

interface FeedRowProps {
  feed: MarqueeFeed;
  displayTitle: string;
  muted: boolean;
  onToggleMute: () => void;
  onRemove: () => void;
  attribution: string;
}

function FeedRow({ feed, displayTitle, muted, onToggleMute, onRemove, attribution }: FeedRowProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(feed.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API unavailable (older browsers, insecure context) —
      // silently ignore; the URL is still visible in the row.
    }
  }

  return (
    <div className={`marquee-feed-row${muted ? ' is-muted' : ''}`}>
      <div className="marquee-feed-info">
        <div className="marquee-feed-title">{displayTitle}</div>
        <div className="marquee-feed-url" title={feed.url}>{feed.url}</div>
        {attribution && <div className="marquee-feed-attr">{attribution}</div>}
      </div>
      <button
        type="button"
        className={`sheet-icon-toggle${copied ? ' on' : ''}`}
        onClick={onCopy}
        aria-label={copied ? 'link copied' : 'copy feed URL'}
        title={copied ? 'copied!' : 'copy feed URL'}
      >
        <Icon name={copied ? 'check' : 'link'} size={12} />
      </button>
      <button
        type="button"
        className={`sheet-icon-toggle${muted ? '' : ' on'}`}
        onClick={onToggleMute}
        aria-pressed={!muted}
        aria-label={muted ? 'unmute source' : 'mute source'}
        title={muted ? 'unmute source' : 'mute source'}
      >
        <Icon name="screen" size={12} />
      </button>
      <button
        type="button"
        className="sheet-icon-toggle"
        onClick={onRemove}
        aria-label="remove feed"
        title="remove feed"
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
