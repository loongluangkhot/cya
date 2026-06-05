"""Web Push fan-out.

`pywebpush` is synchronous (uses `requests` under the hood), so calling
it directly would block the event loop on every push. We wrap each call
in `loop.run_in_executor` with an explicit timeout (otherwise requests
inherits None and a hung endpoint pins an executor thread until the
heat death of the universe) and gather the per-recipient calls — fire
and log, never await in the request handler. Failed deliveries with a
"gone" status (404 / 410) imply the subscription is stale; we drop it
from the room so the next push doesn't bounce again.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from pywebpush import WebPushException, webpush

from config import (
    PUSH_ENABLED,
    VAPID_CONTACT,
    VAPID_PRIVATE_KEY,
)
from models import Room

log = logging.getLogger("cya.push")

# Per-push HTTP timeout passed through to `requests` under pywebpush.
# 10s is comfortable for healthy endpoints and bounded enough that a
# slow/dead provider can't saturate the default ThreadPoolExecutor.
_PUSH_TIMEOUT_S = 10

# Strong refs to running fan-out tasks. CPython only weakly tracks
# tasks created via create_task, so an unreferenced task may be GC'd
# mid-await; we add to this set and discard via done_callback to keep
# them alive for as long as they're running.
_background_tasks: set[asyncio.Task[None]] = set()


def _send_sync(subscription: dict[str, Any], payload: dict[str, Any]) -> None:
    """Synchronous push to a single subscription. Runs in a thread."""
    webpush(
        subscription_info=subscription,
        data=json.dumps(payload),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_CONTACT},
        timeout=_PUSH_TIMEOUT_S,
    )


async def _send_one(
    room: Room, cid: str, subscription: dict[str, Any], payload: dict[str, Any]
) -> None:
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _send_sync, subscription, payload)
    except WebPushException as e:
        status = getattr(e.response, "status_code", None) if e.response else None
        if status in (404, 410):
            # Subscription is permanently gone. Drop so future fan-outs
            # skip this recipient. Other errors (5xx, transient) leave
            # the sub in place — we'll retry on the next event.
            room.push_subscriptions.pop(cid, None)
            log.info("push: dropped stale subscription cid=%s status=%s", cid, status)
        else:
            log.warning("push: WebPushException cid=%s status=%s err=%s", cid, status, e)
    except Exception as e:  # pragma: no cover — defensive
        log.exception("push: unexpected error cid=%s: %s", cid, e)


async def fan_out(
    room: Room,
    payload: dict[str, Any],
    *,
    target_cids: list[str] | None = None,
) -> None:
    """Push `payload` to every subscribed clientId in `target_cids` (or
    all subscribed clientIds if None). Safe to call from a socket
    handler — we never raise to the caller and never block on individual
    sends. Wrap with `spawn(fan_out(...))` if you want true
    fire-and-forget; otherwise this returns once all delivery attempts
    have settled."""
    if not PUSH_ENABLED:
        return
    targets = (
        target_cids if target_cids is not None else list(room.push_subscriptions.keys())
    )
    # Pass raw coroutines (not create_task'd) to gather so a cancel of
    # this fan_out propagates into the underlying _send_one awaits.
    coros = []
    for cid in targets:
        sub = room.push_subscriptions.get(cid)
        if sub is None:
            continue
        coros.append(_send_one(room, cid, sub, payload))
    if not coros:
        return
    await asyncio.gather(*coros, return_exceptions=True)


def spawn(coro: "asyncio.coroutines.Coroutine[Any, Any, Any]") -> asyncio.Task[None]:
    """create_task wrapper that strong-refs the task so the asyncio loop
    can't GC it mid-flight. Callers should use this for fire-and-forget
    fan_out scheduling instead of bare asyncio.create_task()."""
    task: asyncio.Task[None] = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task
