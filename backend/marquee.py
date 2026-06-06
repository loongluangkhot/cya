"""RSS feed fetching, parsing, caching, and per-room refresh loop.

Each subscribed feed URL is fetched globally (one TTL'd cache shared
across rooms via ``feed_cache``); a per-room asyncio task wakes every
``MARQUEE_REFRESH_S`` seconds, asks the cache for fresh items, diffs
them against ``room.marquee_items``, and broadcasts the new set.

The cache decouples per-room loops from per-feed network: ten rooms
subscribed to the same URL share a single fetch, and HTTP routes
serving user-scoped feeds hit the same cache without duplicating work.
"""

from __future__ import annotations

import asyncio
import hashlib
import html
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any

import feedparser
import httpx

from app import sio
from config import (
    MARQUEE_DESCRIPTION_MAX_LEN,
    MARQUEE_FETCH_TIMEOUT_S,
    MARQUEE_ITEMS_CAP,
    MARQUEE_REFRESH_S,
    MARQUEE_TITLE_MAX_LEN,
    MARQUEE_URL_MAX_LEN,
)
from models import MarqueeItem
from rooms import rooms

_USER_AGENT = "cya-marquee/0.1 (+https://cya.app)"
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


@dataclass
class FeedCacheEntry:
    items: list[MarqueeItem] = field(default_factory=list[MarqueeItem])
    title: str = ""
    fetched_at: float = 0.0
    # Last error string, if the most recent fetch failed. Cleared on next success.
    error: str = ""


# Global per-URL cache. Shared across rooms + HTTP routes.
feed_cache: dict[str, FeedCacheEntry] = {}

# Per-room loop tasks. Mirrors mugshots._tasks.
_tasks: dict[str, asyncio.Task[None]] = {}


def _strip_html(s: str) -> str:
    """Crude tag strip + entity unescape + whitespace collapse. RSS
    descriptions often carry inline HTML; we render as plain text so the
    client never touches innerHTML."""
    no_tags = _HTML_TAG_RE.sub(" ", s or "")
    unescaped = html.unescape(no_tags)
    return _WHITESPACE_RE.sub(" ", unescaped).strip()


def _published_ms(entry: Any) -> int:
    """Parse the entry's publish timestamp into ms-since-epoch. Falls
    back to now if the feed omits a usable timestamp — at worst the item
    sorts as "just now" rather than disappearing."""
    parsed = getattr(entry, "published_parsed", None) or getattr(
        entry, "updated_parsed", None
    )
    if parsed is None:
        return int(time.time() * 1000)
    try:
        # struct_time is UTC-naive when feedparser produces it.
        return int(time.mktime(parsed) * 1000)
    except (TypeError, ValueError, OverflowError):
        return int(time.time() * 1000)


def _item_id(entry: Any, link: str) -> str:
    """Stable item id. Prefers RSS's guid/id; falls back to a hash of
    the link so dedup works even on feeds that omit guids."""
    guid = getattr(entry, "id", None) or getattr(entry, "guid", None)
    if isinstance(guid, str) and guid.strip():
        return guid.strip()[:200]
    h = hashlib.sha256((link or "").encode("utf-8")).hexdigest()[:16]
    return f"sha:{h}"


def validate_feed_url(url: str) -> str | None:
    """Return a normalized URL if it looks safe to fetch, else None.
    We're not paranoid here — backend-only fetches, no auth headers
    leaked — just reject obviously malformed input."""
    if not isinstance(url, str):
        return None
    s = url.strip()
    if not s or len(s) > MARQUEE_URL_MAX_LEN:
        return None
    if not (s.startswith("http://") or s.startswith("https://")):
        return None
    return s


async def _fetch_raw(url: str) -> tuple[str, list[MarqueeItem]]:
    """Fetch + parse a single feed. Returns (title, items).
    Raises on network/parse failure — callers translate to error string."""
    async with httpx.AsyncClient(
        timeout=MARQUEE_FETCH_TIMEOUT_S,
        headers={"User-Agent": _USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml, */*"},
        follow_redirects=True,
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        body = resp.content
    parsed = feedparser.parse(body)
    feed_title = ""
    if hasattr(parsed, "feed") and parsed.feed:
        raw_title = getattr(parsed.feed, "title", "") or ""
        feed_title = _strip_html(raw_title)[:MARQUEE_TITLE_MAX_LEN]
    items: list[MarqueeItem] = []
    for entry in getattr(parsed, "entries", []) or []:
        link = (getattr(entry, "link", "") or "").strip()
        raw_title = getattr(entry, "title", "") or ""
        title = _strip_html(raw_title)[:MARQUEE_TITLE_MAX_LEN]
        raw_desc = (
            getattr(entry, "summary", None)
            or getattr(entry, "description", None)
            or ""
        )
        description = _strip_html(raw_desc)[:MARQUEE_DESCRIPTION_MAX_LEN]
        if not title and not link:
            continue
        items.append(
            MarqueeItem(
                id=_item_id(entry, link),
                feed_url=url,
                title=title,
                description=description,
                link=link,
                published_at=_published_ms(entry),
            )
        )
    # Dedupe by id (some feeds repeat), keep first occurrence (newer),
    # cap newest-first.
    items.sort(key=lambda i: i.published_at, reverse=True)
    seen: set[str] = set()
    deduped: list[MarqueeItem] = []
    for it in items:
        if it.id in seen:
            continue
        seen.add(it.id)
        deduped.append(it)
        if len(deduped) >= MARQUEE_ITEMS_CAP:
            break
    return feed_title, deduped


async def fetch(url: str, *, force: bool = False) -> FeedCacheEntry:
    """Return cached items for ``url``, refreshing if stale or ``force``.
    Always returns the cache entry (with ``error`` set if the most recent
    fetch failed) so callers don't have to handle None."""
    now = time.time()
    entry = feed_cache.get(url)
    if entry is not None and not force and (now - entry.fetched_at) < MARQUEE_REFRESH_S:
        return entry
    if entry is None:
        entry = FeedCacheEntry()
        feed_cache[url] = entry
    try:
        title, items = await _fetch_raw(url)
        entry.items = items
        if title:
            entry.title = title
        entry.error = ""
    except (httpx.HTTPError, ValueError) as exc:
        entry.error = str(exc) or exc.__class__.__name__
    entry.fetched_at = now
    return entry


def items_payload(items: list[MarqueeItem]) -> list[dict[str, Any]]:
    return [asdict(i) for i in items]


def _items_equal(a: list[MarqueeItem], b: list[MarqueeItem]) -> bool:
    if len(a) != len(b):
        return False
    for x, y in zip(a, b):
        if x.id != y.id or x.published_at != y.published_at:
            return False
    return True


async def _refresh_room(room_id: str) -> None:
    """Refresh every subscribed feed for the room, broadcast diffs."""
    room = rooms.get(room_id)
    if room is None:
        return
    # Snapshot the URL list — the loop is the only writer of marquee_items,
    # but marquee_feeds can mutate from event handlers between awaits.
    urls = [f.url for f in room.marquee_feeds]
    for url in urls:
        room = rooms.get(room_id)
        if room is None:
            return
        # Skip if the feed was removed mid-refresh.
        if not any(f.url == url for f in room.marquee_feeds):
            continue
        entry = await fetch(url)
        # Recheck after the await.
        room = rooms.get(room_id)
        if room is None:
            return
        if not any(f.url == url for f in room.marquee_feeds):
            continue
        # Update the feed's title in-place if the fetch resolved one.
        if entry.title:
            for f in room.marquee_feeds:
                if f.url == url and not f.title:
                    f.title = entry.title
        prev = room.marquee_items.get(url, [])
        if _items_equal(prev, entry.items):
            if entry.error:
                await sio.emit(
                    "marqueeFeedError",
                    {"feedUrl": url, "error": entry.error},
                    room=room_id,
                )
            continue
        room.marquee_items[url] = list(entry.items)
        await sio.emit(
            "marqueeItemsChanged",
            {"feedUrl": url, "items": items_payload(entry.items)},
            room=room_id,
        )


async def _loop(room_id: str) -> None:
    """Per-room refresh loop. Fires immediately on start so a fresh room
    gets headlines without waiting for the first ``MARQUEE_REFRESH_S``
    tick, then sleeps in 5s chunks so a feed add/remove is picked up
    promptly."""
    try:
        # First pass immediately.
        await _refresh_room(room_id)
        next_at = time.time() + MARQUEE_REFRESH_S
        while True:
            if rooms.get(room_id) is None:
                return
            wait_s = next_at - time.time()
            if wait_s > 0:
                await asyncio.sleep(min(wait_s, 5))
                continue
            await _refresh_room(room_id)
            next_at = time.time() + MARQUEE_REFRESH_S
    except asyncio.CancelledError:
        return
    finally:
        _tasks.pop(room_id, None)


def start(room_id: str) -> None:
    """Begin (or no-op) the per-room marquee loop."""
    if room_id in _tasks:
        return
    _tasks[room_id] = asyncio.create_task(_loop(room_id))


def cancel(room_id: str) -> None:
    """Stop the loop. Idempotent."""
    task = _tasks.pop(room_id, None)
    if task is not None:
        task.cancel()


async def trigger_refresh(room_id: str) -> None:
    """One-shot refresh outside the loop's cadence (e.g. after a feed
    add). The loop continues on its own schedule."""
    await _refresh_room(room_id)
