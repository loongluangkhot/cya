"""Snapshot the in-memory room registry across graceful restarts.

A SIGTERM-only pickle dump + boot-time load lets a redeploy reuse the
live rooms dict instead of evicting everyone. Hard kills (SIGKILL, OOM,
power loss) still lose the snapshot — graceful shutdown is the only
window. That's enough for the original worry (active users surviving a
deploy) and avoids paying per-mutation disk I/O for the crash case.

The snapshot file path is configurable via ``CYA_SNAPSHOT_PATH``; the
default sits in a ``data/`` subdir of the backend directory so dev mode
works without flags and prod just needs a volume mounted there.
"""

from __future__ import annotations

import logging
import os
import pickle
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI

logger = logging.getLogger(__name__)

SNAPSHOT_PATH = Path(
    os.getenv(
        "CYA_SNAPSHOT_PATH",
        str(Path(__file__).parent / "data" / "rooms.pkl"),
    )
)


def _load_snapshot() -> None:
    if not SNAPSHOT_PATH.exists():
        return
    try:
        with SNAPSHOT_PATH.open("rb") as f:
            loaded = pickle.load(f)
    except (
        pickle.UnpicklingError,
        EOFError,
        AttributeError,
        ImportError,
        OSError,
    ) as e:
        # Corrupt / schema-drift / truncated file → start fresh rather
        # than crashloop on boot.
        logger.warning(
            "snapshot load failed at %s: %s — starting fresh", SNAPSHOT_PATH, e
        )
        return
    if not isinstance(loaded, dict):
        logger.warning(
            "snapshot at %s is not a dict (got %s) — starting fresh",
            SNAPSHOT_PATH,
            type(loaded).__name__,
        )
        return

    # Deferred imports: rooms/marquee/mugshots reach back into app.sio,
    # which imports this module — pulling them at module top would cycle.
    from rooms import rooms
    from marquee import start as start_marquee_loop
    from mugshots import start as start_mugshot_loop

    rooms.update(loaded)
    # The per-room mugshot + marquee loops are normally spawned by
    # rooms._init_room. Restored rooms skipped that path, so spin them
    # up here. Out-of-date next_mugshot_at deadlines are handled by the
    # loop itself (sleep clamps to 0).
    for room_id in rooms:
        start_mugshot_loop(room_id)
        start_marquee_loop(room_id)
    logger.info("snapshot loaded: %d room(s) from %s", len(loaded), SNAPSHOT_PATH)


def _save_snapshot() -> None:
    from rooms import rooms

    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = SNAPSHOT_PATH.with_suffix(SNAPSHOT_PATH.suffix + ".tmp")
    try:
        with tmp.open("wb") as f:
            pickle.dump(rooms, f, protocol=pickle.HIGHEST_PROTOCOL)
        # Atomic on POSIX — readers never see a half-written file.
        os.replace(tmp, SNAPSHOT_PATH)
        logger.info("snapshot saved: %d room(s) to %s", len(rooms), SNAPSHOT_PATH)
    except (OSError, pickle.PicklingError) as e:
        logger.warning("snapshot save failed at %s: %s", SNAPSHOT_PATH, e)
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _load_snapshot()
    try:
        yield
    finally:
        _save_snapshot()
