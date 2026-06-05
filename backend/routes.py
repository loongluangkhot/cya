"""HTTP endpoints (REST surface). Importing this module registers all
``@fastapi_app.get/post`` handlers via decorator side effects."""

from __future__ import annotations

from typing import Any

from fastapi import Body, HTTPException, Response

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
async def peek_room_endpoint(room_id: str) -> dict[str, Any]:
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    return {
        "ok": True,
        "id": room.id,
        "users": [
            {"id": u.id, "name": u.name, "character": u.character, "color": u.color}
            for u in room.users.values()
        ],
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
    client treats this as "background notifications unavailable"."""
    return {"publicKey": VAPID_PUBLIC_KEY}


@fastapi_app.post("/api/rooms/{room_id}/push/subscribe")
async def push_subscribe_endpoint(
    room_id: str, payload: dict[str, Any] = Body(...)
) -> dict[str, bool]:
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    client_id = str(payload.get("clientId") or "").strip()
    subscription = payload.get("subscription")
    if not client_id or not isinstance(subscription, dict):
        raise HTTPException(status_code=400, detail={"ok": False})
    if not isinstance(subscription.get("endpoint"), str):
        raise HTTPException(status_code=400, detail={"ok": False})
    # Idempotent: same clientId resubscribing replaces the previous
    # subscription (the browser may rotate endpoints on permission resets).
    room.push_subscriptions[client_id] = subscription
    return {"ok": True}


@fastapi_app.delete("/api/rooms/{room_id}/push/subscribe")
async def push_unsubscribe_endpoint(
    room_id: str, payload: dict[str, Any] = Body(...)
) -> dict[str, bool]:
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail={"ok": False})
    client_id = str(payload.get("clientId") or "").strip()
    if not client_id:
        raise HTTPException(status_code=400, detail={"ok": False})
    room.push_subscriptions.pop(client_id, None)
    return {"ok": True}


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
