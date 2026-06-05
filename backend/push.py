"""Web Push fan-out.

`pywebpush` is synchronous (uses `requests` under the hood), so calling
it directly would block the event loop on every push. We wrap each call
in `loop.run_in_executor` and gather the per-recipient calls — fire and
log, never await in the request handler. Failed deliveries with a
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


def _send_sync(subscription: dict[str, Any], payload: dict[str, Any]) -> None:
    """Synchronous push to a single subscription. Runs in a thread."""
    webpush(
        subscription_info=subscription,
        data=json.dumps(payload),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_CONTACT},
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
    sends. Wrap with `asyncio.create_task(fan_out(...))` if you want
    true fire-and-forget; otherwise this returns once all delivery
    attempts have settled."""
    if not PUSH_ENABLED:
        return
    targets = (
        target_cids if target_cids is not None else list(room.push_subscriptions.keys())
    )
    coros: list[asyncio.Future[None] | asyncio.Task[None]] = []
    for cid in targets:
        sub = room.push_subscriptions.get(cid)
        if sub is None:
            continue
        coros.append(asyncio.create_task(_send_one(room, cid, sub, payload)))
    if not coros:
        return
    await asyncio.gather(*coros, return_exceptions=True)
