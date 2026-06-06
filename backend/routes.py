"""HTTP endpoints (REST surface). Importing this module registers all
``@fastapi_app.get/post`` handlers via decorator side effects."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import Body, HTTPException, Response

import marquee
from app import fastapi_app
from config import VAPID_PUBLIC_KEY, YT_EXAMPLES
from rooms import create_room, rooms


@fastapi_app.get("/api/youtube/examples")
async def youtube_examples_endpoint() -> dict[str, Any]:
    return {"examples": YT_EXAMPLES}


@fastapi_app.post("/api/rooms")
async def create_room_endpoint() -> dict[str, str]:
    room = create_room()
    return {"id": room.id}


@fastapi_app.get("/api/rooms/{room_id}")
async def get_room_endpoint(room_id: str) -> dict[str, Any]:
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    return {"ok": True, "id": room.id}


@fastapi_app.get("/api/rooms/{room_id}/peek")
async def peek_room_endpoint(
    room_id: str, clientId: str | None = None
) -> dict[str, Any]:
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    # `youAreIn` reflects the grace window: a recently-disconnected client
    # still occupies room.users for USER_GRACE_S, so the frontend can skip
    # the drop-in screen on a tab-reopen within that window.
    you_are_in = bool(clientId and clientId in room.users)
    return {
        "ok": True,
        "id": room.id,
        "users": [
            {"id": u.id, "name": u.name, "character": u.character, "color": u.color}
            for u in room.users.values()
        ],
        "youAreIn": you_are_in,
    }


@fastapi_app.get("/api/rooms/{room_id}/audio/{message_id}")
async def get_audio_endpoint(room_id: str, message_id: str) -> Response:
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    blob = room.audio_blobs.get(message_id)
    if blob is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    msg = next((m for m in room.messages if m.id == message_id), None)
    mime = msg.audioMime if msg and msg.audioMime else "application/octet-stream"
    return Response(
        content=blob,
        media_type=mime,
        # Audio rows fetch on demand; cache aggressively so a re-render or
        # tab-revisit doesn't re-hit the server with a 5MB body.
        headers={"Cache-Control": "private, max-age=3600, immutable"},
    )


@fastapi_app.get("/api/push/vapid-public-key")
async def get_vapid_public_key_endpoint() -> dict[str, str]:
    """Public VAPID key as raw base64-url-safe string. The client
    converts it to a Uint8Array before calling pushManager.subscribe.
    Empty string means push is not configured on this server — the
    client treats this as "background notifications unavailable".

    Subscription registration itself is a socket.io event (see
    `subscribePush` / `unsubscribePush` in events.py) so the
    clientId is authenticated via the socket session — a peer can't
    forge another user's subscription via a public HTTP body."""
    return {"publicKey": VAPID_PUBLIC_KEY}


@fastapi_app.post("/api/marquee/preview")
async def marquee_preview_endpoint(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Fetch (or cache-hit) a feed URL and return its title + a sample
    of items. Used by the client's "Add feed" UI to validate a URL
    before saving it. Also serves as the data source for user-scoped
    (private) feeds, which never get persisted on the room."""
    raw_url = payload.get("url") if isinstance(payload, dict) else None
    url = marquee.validate_feed_url(raw_url if isinstance(raw_url, str) else "")
    if not url:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "bad_url"})
    entry = await marquee.fetch(url)
    if entry.error and not entry.items:
        # Distinguish "couldn't fetch at all" from "fetched, found nothing".
        raise HTTPException(
            status_code=502,
            detail={"ok": False, "error": entry.error[:200]},
        )
    return {
        "ok": True,
        "url": url,
        "title": entry.title,
        "items": [asdict(i) for i in entry.items],
    }


@fastapi_app.post("/api/marquee/items")
async def marquee_items_endpoint(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Return cached items for a single feed URL. Same TTL'd cache as
    /preview — used by the client to poll user-scoped feeds at the
    same cadence as the per-room loop."""
    raw_url = payload.get("url") if isinstance(payload, dict) else None
    url = marquee.validate_feed_url(raw_url if isinstance(raw_url, str) else "")
    if not url:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "bad_url"})
    entry = await marquee.fetch(url)
    return {
        "ok": True,
        "url": url,
        "title": entry.title,
        "error": entry.error,
        "items": [asdict(i) for i in entry.items],
    }


@fastapi_app.get("/api/rooms/{room_id}/mugshot/{user_id}")
async def get_mugshot_endpoint(room_id: str, user_id: str) -> Response:
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    blob = room.mugshots.get(user_id)
    if blob is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    return Response(
        content=blob.data,
        media_type=blob.mime,
        # Clients pin the URL to ?t={takenAt}; new shots get fresh URLs
        # so caching the immutable bytes is safe.
        headers={"Cache-Control": "private, max-age=3600, immutable"},
    )
