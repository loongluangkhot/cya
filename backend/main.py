from __future__ import annotations

import random
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse

from words import generate_slug

ROOM_WIDTH = 1280
ROOM_HEIGHT = 720
MAX_HISTORY = 100
NAME_MAX = 20
MSG_MAX = 200


@dataclass
class User:
    id: str
    name: str
    character: str
    color: str
    x: float
    y: float
    direction: str


@dataclass
class ChatMessage:
    id: str
    userId: str
    name: str
    character: str
    color: str
    text: str
    timestamp: int


@dataclass
class Ambient:
    time: str = "dawn"
    weather: str = "clear"
    room: str = "clearing"


@dataclass
class Room:
    id: str
    ambient: Ambient = field(default_factory=Ambient)
    track_uri: str | None = None
    is_playing: bool = False
    position_ms: int = 0
    position_updated_at: float = 0.0
    users: dict[str, User] = field(default_factory=dict)
    messages: list[ChatMessage] = field(default_factory=list)


def _playback_snapshot(room: Room) -> dict[str, Any]:
    return {
        "trackUri": room.track_uri,
        "isPlaying": room.is_playing,
        "positionMs": room.position_ms,
        "positionUpdatedAt": room.position_updated_at,
    }


rooms: dict[str, Room] = {}


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


@sio.on("join")
async def on_join(sid: str, payload: dict[str, Any]) -> dict[str, Any]:
    room_id = str(payload.get("roomId") or "")
    room = rooms.get(room_id)
    if room is None:
        return {"ok": False, "error": "room_not_found"}

    await sio.save_session(sid, {"roomId": room.id})
    await sio.enter_room(sid, room.id)

    raw_name = str(payload.get("name") or "Guest")[:NAME_MAX].strip()
    safe_name = raw_name or "Guest"
    safe_char = str(payload.get("character") or "chef")[:40]
    safe_color = str(payload.get("color") or "leaf")[:40]

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
        },
        to=sid,
    )
    await sio.emit("userJoined", asdict(user), room=room.id, skip_sid=sid)
    return {"ok": True}


@sio.on("move")
async def on_move(sid: str, payload: dict[str, Any]) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    user = room.users.get(sid)
    if user is None:
        return
    try:
        x = float(payload.get("x") or 0)
        y = float(payload.get("y") or 0)
    except (TypeError, ValueError):
        return
    user.x = clamp(x, 0, ROOM_WIDTH)
    user.y = clamp(y, 0, ROOM_HEIGHT)
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
async def on_update_character(sid: str, payload: dict[str, Any]) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    user = room.users.get(sid)
    if user is None:
        return
    safe = str(payload.get("character") or "")[:40]
    if not safe:
        return
    user.character = safe
    await sio.emit(
        "userUpdated",
        {"id": sid, "character": user.character},
        room=room.id,
    )


@sio.on("updateName")
async def on_update_name(sid: str, payload: dict[str, Any]) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    user = room.users.get(sid)
    if user is None:
        return
    safe = str(payload.get("name") or "")[:NAME_MAX].strip()
    if not safe:
        return
    user.name = safe
    await sio.emit(
        "userUpdated",
        {"id": sid, "name": user.name},
        room=room.id,
    )


@sio.on("updatePlayback")
async def on_update_playback(sid: str, payload: dict[str, Any]) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    raw_uri = payload.get("trackUri")
    if raw_uri is None:
        track_uri: str | None = None
    else:
        track_uri = str(raw_uri)[:200].strip() or None
    room.track_uri = track_uri
    room.is_playing = bool(payload.get("isPlaying", False))
    try:
        room.position_ms = max(0, int(payload.get("positionMs") or 0))
    except (TypeError, ValueError):
        room.position_ms = 0
    room.position_updated_at = time.time() * 1000
    await sio.emit(
        "playbackChanged",
        _playback_snapshot(room),
        room=room.id,
        skip_sid=sid,
    )


@sio.on("updateColor")
async def on_update_color(sid: str, payload: dict[str, Any]) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    user = room.users.get(sid)
    if user is None:
        return
    color = str(payload.get("color") or "")[:40]
    if not color:
        return
    user.color = color
    await sio.emit(
        "userUpdated",
        {"id": sid, "color": color},
        room=room.id,
    )


_AMBIENT_TIMES = {"dawn", "day", "dusk", "night"}
_AMBIENT_WEATHERS = {"clear", "rain", "snow", "fog"}
_AMBIENT_ROOMS = {"clearing", "plaza"}


@sio.on("updateAmbient")
async def on_update_ambient(sid: str, payload: dict[str, Any]) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    changed = False
    t = payload.get("time")
    if isinstance(t, str) and t in _AMBIENT_TIMES and t != room.ambient.time:
        room.ambient.time = t
        changed = True
    w = payload.get("weather")
    if isinstance(w, str) and w in _AMBIENT_WEATHERS and w != room.ambient.weather:
        room.ambient.weather = w
        changed = True
    r = payload.get("room")
    if isinstance(r, str) and r in _AMBIENT_ROOMS and r != room.ambient.room:
        room.ambient.room = r
        changed = True
    if not changed:
        return
    await sio.emit("ambientChanged", asdict(room.ambient), room=room.id)


@sio.on("chat")
async def on_chat(sid: str, payload: dict[str, Any]) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    user = room.users.get(sid)
    if user is None:
        return
    text = str(payload.get("text") or "")[:MSG_MAX].strip()
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
