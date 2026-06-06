"""In-memory room registry plus the disconnect-grace eviction policy.

A room is born from ``create_room`` (HTTP) and lives in ``rooms`` until
nobody can plausibly return: every user has either been fully cleaned
up by the per-user grace (USER_GRACE_S) or has no remaining sids, and
ROOM_GRACE_S then elapses on top. The two grace windows are stacked so
a user who backgrounds their tab still finds the room when they come
back later in the day.
"""

from __future__ import annotations

import asyncio
import random
import time

from config import (
    MARQUEE_DEFAULT_FEED_URLS,
    MARQUEE_FEED_MAX_PER_ROOM,
    MUGSHOT_INTERVAL_DEFAULT_S,
    ROOM_GRACE_S,
    ROOM_HEIGHT,
    ROOM_WIDTH,
)
from models import MarqueeFeed, Room
from words import generate_slug

rooms: dict[str, Room] = {}

# Eviction tasks scheduled when a room empties. A late join cancels the
# task and the room survives; otherwise it fires after ROOM_GRACE_S and
# pops the room from `rooms`.
_pending_evictions: dict[str, asyncio.Task[None]] = {}


async def _evict_room_later(room_id: str) -> None:
    try:
        await asyncio.sleep(ROOM_GRACE_S)
    except asyncio.CancelledError:
        return
    _pending_evictions.pop(room_id, None)
    room = rooms.get(room_id)
    if room is None:
        return
    # Re-check: the room is evictable only if no live sids remain across
    # all clientIds. Away users with active grace cleanups still count
    # as "in the room" from a presence perspective, but their cleanup
    # task will pop them well before we'd evict the room itself.
    has_any_sid = any(sids for sids in room.client_to_sids.values())
    if has_any_sid:
        return
    rooms.pop(room_id, None)
    # Local import breaks the rooms ↔ mugshots cycle (mugshots needs
    # the rooms dict; we only need its cancel hook here).
    from marquee import cancel as cancel_marquee_loop
    from mugshots import cancel as cancel_mugshot_loop

    cancel_mugshot_loop(room_id)
    cancel_marquee_loop(room_id)
    # Outstanding per-user cleanup tasks are now orphaned — their target
    # room is gone, so cancel them to avoid a tiny pile of zombie tasks.
    for task in list(room.pending_user_cleanups.values()):
        task.cancel()
    room.pending_user_cleanups.clear()


def cancel_pending_eviction(room_id: str) -> None:
    task = _pending_evictions.pop(room_id, None)
    if task is not None:
        task.cancel()


def schedule_eviction(room_id: str) -> None:
    """Schedule a delayed eviction for an empty room. No-op if one is
    already pending — we never double-schedule."""
    if room_id in _pending_evictions:
        return
    _pending_evictions[room_id] = asyncio.create_task(_evict_room_later(room_id))


def _init_room(slug: str) -> Room:
    """Construct a Room, seed mugshot defaults from env, and start its
    background mugshot loop. Kept private so create_room is the only path
    that wires the loop up — direct ``Room()`` constructions in tests
    won't accidentally spawn unsupervised asyncio tasks."""
    room = Room(id=slug)
    room.mugshot_interval_s = MUGSHOT_INTERVAL_DEFAULT_S
    room.next_mugshot_at = (time.time() + room.mugshot_interval_s) * 1000
    # Seed env-configured default RSS feeds. Title is empty until the
    # marquee loop's first fetch resolves it (the client falls back to
    # the URL host). Cap at the per-room limit so a misconfigured env
    # var can't blow past it.
    for url in MARQUEE_DEFAULT_FEED_URLS[:MARQUEE_FEED_MAX_PER_ROOM]:
        room.marquee_feeds.append(MarqueeFeed(url=url, title="", added_by=None))
    rooms[slug] = room
    # Local imports break the rooms ↔ {mugshots, marquee} cycles.
    from marquee import start as start_marquee_loop
    from mugshots import start as start_mugshot_loop

    start_mugshot_loop(slug)
    start_marquee_loop(slug)
    return room


def create_room() -> Room:
    for _ in range(5):
        slug = generate_slug()
        if slug not in rooms:
            return _init_room(slug)
    # Slug collisions five times running is unlikely but possible — fall
    # back to a time-suffixed slug so we always return a usable room.
    suffix = format(int(time.time() * 1000) & 0xFFFF, "x")
    slug = f"{generate_slug()}-{suffix}"
    return _init_room(slug)


def random_spawn() -> tuple[float, float]:
    x = 120 + random.random() * (ROOM_WIDTH - 240)
    y = 220 + random.random() * (ROOM_HEIGHT - 320)
    return float(int(x)), float(int(y))


def clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))
