"""In-memory room registry plus the disconnect-grace eviction policy.

A room is born from ``create_room`` (HTTP) and lives in ``rooms`` until
either everyone leaves AND the ``ROOM_GRACE_S`` window elapses, or the
process is restarted. The grace window absorbs OAuth redirects, brief
phone-call interruptions, and tab refreshes so users can come back to
their room.
"""

from __future__ import annotations

import asyncio
import random
import time

from config import ROOM_GRACE_S, ROOM_HEIGHT, ROOM_WIDTH
from models import Room
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
    if room is not None and not room.users:
        rooms.pop(room_id, None)


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


def create_room() -> Room:
    for _ in range(5):
        slug = generate_slug()
        if slug not in rooms:
            room = Room(id=slug)
            rooms[slug] = room
            return room
    # Slug collisions five times running is unlikely but possible — fall
    # back to a time-suffixed slug so we always return a usable room.
    suffix = format(int(time.time() * 1000) & 0xFFFF, "x")
    slug = f"{generate_slug()}-{suffix}"
    room = Room(id=slug)
    rooms[slug] = room
    return room


def random_spawn() -> tuple[float, float]:
    x = 120 + random.random() * (ROOM_WIDTH - 240)
    y = 220 + random.random() * (ROOM_HEIGHT - 320)
    return float(int(x)), float(int(y))


def clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))
