from __future__ import annotations

import asyncio
import random
import time
import uuid
from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse

from payloads import (
    AMBIENT_ROOMS,
    AMBIENT_TIMES,
    AMBIENT_WEATHERS,
    AddManyToQueuePayload,
    AddToQueuePayload,
    AdvanceQueuePayload,
    ChatPayload,
    JoinPayload,
    MovePayload,
    PlaybackSnapshot,
    PlayCollectionPayload,
    RemoveFromQueuePayload,
    UpdateAmbientPayload,
    UpdateCharacterPayload,
    UpdateColorPayload,
    UpdateNamePayload,
    UpdatePlaybackPayload,
)
from words import generate_slug

ROOM_WIDTH = 1280
ROOM_HEIGHT = 720
MAX_HISTORY = 100
NAME_MAX = 20
MSG_MAX = 200
# Grace window after the last user disconnects before the room is evicted.
# Long enough that the Spotify OAuth round-trip (redirect → consent →
# callback → reconnect) doesn't lose the room.
ROOM_GRACE_S = 90


# Wire shapes — these dataclasses round-trip through dataclasses.asdict()
# straight into socket.io payloads, so the fields here must match the
# matching TypeScript interfaces in frontend/src/types.ts (look for the
# `@sync: backend/main.py:<Name>` markers there).


# @sync: frontend/src/types.ts:User
@dataclass
class User:
    id: str
    name: str
    character: str
    color: str
    x: float
    y: float
    direction: str


# @sync: frontend/src/types.ts:ChatMessage
@dataclass
class ChatMessage:
    id: str
    userId: str
    name: str
    character: str
    color: str
    text: str
    timestamp: int


# @sync: frontend/src/types.ts:Ambient
@dataclass
class Ambient:
    time: str = "dawn"
    weather: str = "clear"
    room: str = "clearing"
    # 0..100. Multiplier on the weather overlay's opacity client-side.
    intensity: int = 70


@dataclass
class Room:
    id: str
    ambient: Ambient = field(default_factory=Ambient)
    track_uri: str | None = None
    is_playing: bool = False
    position_ms: int = 0
    position_updated_at: float = 0.0
    queue: list[str] = field(default_factory=list[str])
    users: dict[str, User] = field(default_factory=dict[str, User])
    messages: list[ChatMessage] = field(default_factory=list[ChatMessage])


def _playback_snapshot(room: Room) -> PlaybackSnapshot:
    return {
        "trackUri": room.track_uri,
        "isPlaying": room.is_playing,
        "positionMs": room.position_ms,
        "positionUpdatedAt": room.position_updated_at,
    }


def _safe_string(
    payload: Mapping[str, Any],
    key: str,
    *,
    default: str = "",
    max_len: int = 40,
    strip: bool = False,
) -> str:
    raw = str(payload.get(key) or default)[:max_len]
    return raw.strip() if strip else raw


def _safe_int(
    payload: Mapping[str, Any],
    key: str,
    *,
    default: int = 0,
    lo: int | None = None,
    hi: int | None = None,
) -> int:
    try:
        n = int(payload.get(key) or default)
    except (TypeError, ValueError):
        n = default
    if lo is not None:
        n = max(lo, n)
    if hi is not None:
        n = min(hi, n)
    return n


def _safe_float(payload: Mapping[str, Any], key: str, default: float = 0.0) -> float:
    try:
        return float(payload.get(key) or default)
    except (TypeError, ValueError):
        return default


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


def _cancel_pending_eviction(room_id: str) -> None:
    task = _pending_evictions.pop(room_id, None)
    if task is not None:
        task.cancel()


def create_room() -> Room:
    for _ in range(5):
        slug = generate_slug()
        if slug not in rooms:
            room = Room(id=slug)
            rooms[slug] = room
            return room
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


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
fastapi_app = FastAPI()
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


async def _current_room(sid: str) -> Room | None:
    session = await sio.get_session(sid)
    room_id = session.get("roomId") if session else None
    if not room_id:
        return None
    return rooms.get(room_id)


async def _update_user_field(
    sid: str,
    payload: Mapping[str, Any],
    key: str,
    *,
    max_len: int,
    strip: bool = False,
) -> None:
    """Sanitize a payload string and assign it to user.<key>, then broadcast."""
    room = await _current_room(sid)
    if room is None:
        return
    user = room.users.get(sid)
    if user is None:
        return
    safe = _safe_string(payload, key, max_len=max_len, strip=strip)
    if not safe:
        return
    setattr(user, key, safe)
    await sio.emit("userUpdated", {"id": sid, key: safe}, room=room.id)


@sio.on("join")
async def on_join(sid: str, payload: JoinPayload) -> dict[str, Any]:
    room_id = str(payload.get("roomId") or "")
    room = rooms.get(room_id)
    if room is None:
        return {"ok": False, "error": "room_not_found"}

    # Reconnecting before the grace window expires keeps the room alive.
    _cancel_pending_eviction(room.id)

    await sio.save_session(sid, {"roomId": room.id})
    await sio.enter_room(sid, room.id)

    safe_name = (
        _safe_string(payload, "name", default="Guest", max_len=NAME_MAX, strip=True)
        or "Guest"
    )
    safe_char = _safe_string(payload, "character", default="chef", max_len=40)
    safe_color = _safe_string(payload, "color", default="leaf", max_len=40)

    x, y = random_spawn()
    user = User(
        id=sid,
        name=safe_name,
        character=safe_char,
        color=safe_color,
        x=x,
        y=y,
        direction="right",
    )
    room.users[sid] = user

    await sio.emit(
        "state",
        {
            "you": asdict(user),
            "users": [asdict(u) for u in room.users.values()],
            "messages": [asdict(m) for m in room.messages],
            "room": {"width": ROOM_WIDTH, "height": ROOM_HEIGHT},
            "ambient": asdict(room.ambient),
            "playback": _playback_snapshot(room),
            "queue": list(room.queue),
        },
        to=sid,
    )
    await sio.emit("userJoined", asdict(user), room=room.id, skip_sid=sid)
    return {"ok": True}


@sio.on("move")
async def on_move(sid: str, payload: MovePayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    user = room.users.get(sid)
    if user is None:
        return
    user.x = clamp(_safe_float(payload, "x"), 0, ROOM_WIDTH)
    user.y = clamp(_safe_float(payload, "y"), 0, ROOM_HEIGHT)
    direction = payload.get("direction")
    if direction in ("left", "right"):
        user.direction = direction
    await sio.emit(
        "userMoved",
        {"id": user.id, "x": user.x, "y": user.y, "direction": user.direction},
        room=room.id,
        skip_sid=sid,
    )


@sio.on("updateCharacter")
async def on_update_character(sid: str, payload: UpdateCharacterPayload) -> None:
    await _update_user_field(sid, payload, "character", max_len=40)


@sio.on("updateName")
async def on_update_name(sid: str, payload: UpdateNamePayload) -> None:
    await _update_user_field(sid, payload, "name", max_len=NAME_MAX, strip=True)


def _clean_uri(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw)[:200].strip()
    if not s.startswith("spotify:track:"):
        return None
    return s


@sio.on("updatePlayback")
async def on_update_playback(sid: str, payload: UpdatePlaybackPayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    raw_uri = payload.get("trackUri")
    if raw_uri is None:
        track_uri: str | None = None
    else:
        track_uri = _clean_uri(raw_uri)
    room.track_uri = track_uri
    room.is_playing = bool(payload.get("isPlaying", False))
    room.position_ms = _safe_int(payload, "positionMs", lo=0)
    room.position_updated_at = time.time() * 1000
    await sio.emit(
        "playbackChanged",
        _playback_snapshot(room),
        room=room.id,
        skip_sid=sid,
    )


QUEUE_MAX = 200


def _clean_uri_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for r in raw:
        u = _clean_uri(r)
        if u:
            out.append(u)
    return out


@sio.on("addToQueue")
async def on_add_to_queue(sid: str, payload: AddToQueuePayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    uri = _clean_uri(payload.get("uri"))
    if not uri:
        return
    if len(room.queue) >= QUEUE_MAX:
        return
    room.queue.append(uri)
    await sio.emit("queueChanged", {"queue": list(room.queue)}, room=room.id)


@sio.on("addManyToQueue")
async def on_add_many_to_queue(sid: str, payload: AddManyToQueuePayload) -> None:
    """Append multiple URIs to the queue in one round-trip (capped at QUEUE_MAX)."""
    room = await _current_room(sid)
    if room is None:
        return
    new_uris = _clean_uri_list(payload.get("uris"))
    if not new_uris:
        return
    available = max(0, QUEUE_MAX - len(room.queue))
    if available == 0:
        return
    room.queue.extend(new_uris[:available])
    await sio.emit("queueChanged", {"queue": list(room.queue)}, room=room.id)


@sio.on("playCollection")
async def on_play_collection(sid: str, payload: PlayCollectionPayload) -> None:
    """Start playing a collection (album/playlist): first URI becomes the
    now-playing track, the rest replace the queue. Pre-existing queue is
    dropped — this is the bulk "play now" verb."""
    room = await _current_room(sid)
    if room is None:
        return
    cleaned = _clean_uri_list(payload.get("uris"))
    if not cleaned:
        return
    first = cleaned[0]
    # Keep total room.queue + now-playing ≤ QUEUE_MAX.
    rest = cleaned[1:QUEUE_MAX]
    room.track_uri = first
    room.is_playing = True
    room.position_ms = 0
    room.position_updated_at = time.time() * 1000
    room.queue = list(rest)
    await sio.emit("queueChanged", {"queue": list(room.queue)}, room=room.id)
    await sio.emit("playbackChanged", _playback_snapshot(room), room=room.id)


@sio.on("removeFromQueue")
async def on_remove_from_queue(sid: str, payload: RemoveFromQueuePayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    # Remove by exact (uri, index) match if index provided — otherwise first
    # occurrence of the URI.
    uri = _clean_uri(payload.get("uri"))
    if not uri:
        return
    raw_idx = payload.get("index")
    if isinstance(raw_idx, int) and 0 <= raw_idx < len(room.queue) and room.queue[raw_idx] == uri:
        del room.queue[raw_idx]
    else:
        try:
            room.queue.remove(uri)
        except ValueError:
            return
    await sio.emit("queueChanged", {"queue": list(room.queue)}, room=room.id)


@sio.on("clearQueue")
async def on_clear_queue(sid: str, *_args: Any) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    if not room.queue:
        return
    room.queue.clear()
    await sio.emit("queueChanged", {"queue": []}, room=room.id)


@sio.on("advanceQueue")
async def on_advance_queue(sid: str, payload: AdvanceQueuePayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    # Idempotent: only advance if caller's "expected current track" matches.
    # This prevents multiple clients racing to advance at end-of-track.
    expected = _clean_uri(payload.get("afterTrackUri"))
    if expected is not None and room.track_uri is not None and expected != room.track_uri:
        return
    if not room.queue:
        # Nothing to advance to — clear playback.
        room.track_uri = None
        room.is_playing = False
        room.position_ms = 0
        room.position_updated_at = time.time() * 1000
        await sio.emit("playbackChanged", _playback_snapshot(room), room=room.id)
        return
    next_uri = room.queue.pop(0)
    room.track_uri = next_uri
    room.is_playing = True
    room.position_ms = 0
    room.position_updated_at = time.time() * 1000
    await sio.emit("queueChanged", {"queue": list(room.queue)}, room=room.id)
    await sio.emit("playbackChanged", _playback_snapshot(room), room=room.id)


@sio.on("updateColor")
async def on_update_color(sid: str, payload: UpdateColorPayload) -> None:
    await _update_user_field(sid, payload, "color", max_len=40)


@sio.on("updateAmbient")
async def on_update_ambient(sid: str, payload: UpdateAmbientPayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    changed = False
    t = payload.get("time")
    if isinstance(t, str) and t in AMBIENT_TIMES and t != room.ambient.time:
        room.ambient.time = t
        changed = True
    w = payload.get("weather")
    if isinstance(w, str) and w in AMBIENT_WEATHERS and w != room.ambient.weather:
        room.ambient.weather = w
        changed = True
    r = payload.get("room")
    if isinstance(r, str) and r in AMBIENT_ROOMS and r != room.ambient.room:
        room.ambient.room = r
        changed = True
    if "intensity" in payload and payload["intensity"] is not None:
        clamped = _safe_int(payload, "intensity", default=room.ambient.intensity, lo=0, hi=100)
        if clamped != room.ambient.intensity:
            room.ambient.intensity = clamped
            changed = True
    if not changed:
        return
    await sio.emit("ambientChanged", asdict(room.ambient), room=room.id)


@sio.on("chat")
async def on_chat(sid: str, payload: ChatPayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    user = room.users.get(sid)
    if user is None:
        return
    text = _safe_string(payload, "text", max_len=MSG_MAX, strip=True)
    if not text:
        return
    message = ChatMessage(
        id=str(uuid.uuid4()),
        userId=user.id,
        name=user.name,
        character=user.character,
        color=user.color,
        text=text,
        timestamp=int(time.time() * 1000),
    )
    room.messages.append(message)
    if len(room.messages) > MAX_HISTORY:
        room.messages.pop(0)
    await sio.emit("chatMessage", asdict(message), room=room.id)


@sio.on("disconnect")
async def on_disconnect(sid: str) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    if sid not in room.users:
        return
    del room.users[sid]
    await sio.emit("userLeft", {"id": sid}, room=room.id)
    # Schedule an eviction so empty rooms don't accumulate, but leave a
    # grace window so a quick redirect-out-and-back (e.g. Spotify OAuth)
    # doesn't blow the room away before the user returns. A late join
    # cancels the task in on_join().
    if not room.users and room.id not in _pending_evictions:
        _pending_evictions[room.id] = asyncio.create_task(_evict_room_later(room.id))


CLIENT_DIST = Path(__file__).resolve().parent.parent / "client" / "dist"

if CLIENT_DIST.exists():

    @fastapi_app.get("/{full_path:path}", include_in_schema=False)
    async def spa_or_static(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = CLIENT_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(CLIENT_DIST / "index.html")

else:

    @fastapi_app.get("/", include_in_schema=False)
    async def root() -> PlainTextResponse:
        return PlainTextResponse(
            "cya server is running. The client has not been built yet.\n"
            "Run `npm run dev` from the repo root, or build with "
            "`npm run build` then `npm start`.\n"
        )

asgi_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
