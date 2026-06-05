"""Per-room mugshot prompt scheduler.

A background asyncio task per room sleeps until ``room.next_mugshot_at``,
broadcasts a ``mugshotPrompt`` event, advances the deadline, and loops.
The task is cancelled when the room is evicted (via the local import in
``rooms._evict_room_later``) and restarted whenever the interval
changes (so we don't keep sleeping toward a now-stale deadline).
"""

from __future__ import annotations

import asyncio
import time

from app import sio
from rooms import rooms

_tasks: dict[str, asyncio.Task[None]] = {}


async def _loop(room_id: str) -> None:
    try:
        while True:
            room = rooms.get(room_id)
            if room is None:
                return
            now_ms = time.time() * 1000
            wait_ms = room.next_mugshot_at - now_ms
            if wait_ms > 0:
                # Sleep in chunks so an interval change rescheduling
                # next_mugshot_at earlier is noticed within ~5s.
                await asyncio.sleep(min(wait_ms / 1000, 5))
                continue
            room.next_mugshot_at = now_ms + room.mugshot_interval_s * 1000
            await sio.emit(
                "mugshotPrompt",
                {"nextAt": room.next_mugshot_at},
                room=room_id,
            )
    except asyncio.CancelledError:
        return
    finally:
        _tasks.pop(room_id, None)


def start(room_id: str) -> None:
    """Begin (or no-op) the per-room mugshot loop."""
    if room_id in _tasks:
        return
    _tasks[room_id] = asyncio.create_task(_loop(room_id))


def cancel(room_id: str) -> None:
    """Stop the loop. Idempotent."""
    task = _tasks.pop(room_id, None)
    if task is not None:
        task.cancel()


def restart(room_id: str) -> None:
    """Cancel + start. Used after interval changes so the loop picks up
    the new ``next_mugshot_at`` immediately instead of waiting out the
    old sleep."""
    cancel(room_id)
    start(room_id)
