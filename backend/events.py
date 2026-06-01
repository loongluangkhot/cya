"""socket.io event handlers.

Importing this module registers every ``@sio.on(...)`` handler via
decorator side effects. The handlers all share three concerns: resolve
the caller's room/user, sanitize the payload, mutate room state, then
broadcast the diff.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Mapping
from dataclasses import asdict
from typing import Any

from app import sio
from audio import enforce_audio_cap, trim_history
from config import (
    ALLOWED_VOICE_MIMES,
    MAX_VOICE_BYTES,
    MAX_VOICE_DURATION_MS,
    MEMO_MAX,
    MSG_MAX,
    NAME_MAX,
    QUEUE_MAX,
    ROOM_HEIGHT,
    ROOM_WIDTH,
)
from models import ChatMessage, Room, User
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
    UpdateMemoPayload,
    UpdateNamePayload,
    UpdatePlaybackPayload,
)
from rooms import (
    cancel_pending_eviction,
    clamp,
    random_spawn,
    rooms,
    schedule_eviction,
)
from validation import clean_uri, clean_uri_list, safe_float, safe_int, safe_string


# ───────────────── Lookup helpers ─────────────────


async def _current_room(sid: str) -> Room | None:
    session = await sio.get_session(sid)
    room_id = session.get("roomId") if session else None
    if not room_id:
        return None
    return rooms.get(room_id)


async def _authed_user(sid: str) -> tuple[Room, User] | None:
    """Resolve (room, user) for the caller in one step. Returns None if
    the sid isn't joined to a room or somehow isn't in the user dict —
    callers should bail in either case."""
    room = await _current_room(sid)
    if room is None:
        return None
    user = room.users.get(sid)
    if user is None:
        return None
    return room, user


# ───────────────── Wire snapshots ─────────────────


def _playback_snapshot(room: Room) -> PlaybackSnapshot:
    return {
        "trackUri": room.track_uri,
        "isPlaying": room.is_playing,
        "positionMs": room.position_ms,
        "positionUpdatedAt": room.position_updated_at,
    }


def _state_snapshot(room: Room, user: User) -> dict[str, Any]:
    return {
        "you": asdict(user),
        "users": [asdict(u) for u in room.users.values()],
        "messages": [asdict(m) for m in room.messages],
        "room": {"width": ROOM_WIDTH, "height": ROOM_HEIGHT},
        "ambient": asdict(room.ambient),
        "playback": _playback_snapshot(room),
        "queue": list(room.queue),
    }


# ───────────────── Identity field updates ─────────────────


async def _update_user_field(
    sid: str,
    payload: Mapping[str, Any],
    key: str,
    *,
    max_len: int,
    strip: bool = False,
    allow_empty: bool = False,
) -> None:
    """Sanitize a payload string and assign it to user.<key>, then broadcast.

    ``allow_empty`` lets memo / similar clearable fields go back to ''
    without short-circuiting; the default behaviour (for name/character/
    color) is to ignore empty payloads so a typo doesn't blank a field.
    """
    pair = await _authed_user(sid)
    if pair is None:
        return
    room, user = pair
    safe = safe_string(payload, key, max_len=max_len, strip=strip)
    if not safe and not allow_empty:
        return
    setattr(user, key, safe)
    await sio.emit("userUpdated", {"id": sid, key: safe}, room=room.id)


# ───────────────── Join / disconnect ─────────────────


@sio.on("join")
async def on_join(sid: str, payload: JoinPayload) -> dict[str, Any]:
    room_id = str(payload.get("roomId") or "")
    room = rooms.get(room_id)
    if room is None:
        return {"ok": False, "error": "room_not_found"}

    # Reconnecting before the grace window expires keeps the room alive.
    cancel_pending_eviction(room.id)

    await sio.save_session(sid, {"roomId": room.id})
    await sio.enter_room(sid, room.id)

    safe_name = (
        safe_string(payload, "name", default="Guest", max_len=NAME_MAX, strip=True)
        or "Guest"
    )
    safe_char = safe_string(payload, "character", default="chef", max_len=40)
    safe_color = safe_string(payload, "color", default="leaf", max_len=40)
    safe_memo = safe_string(payload, "memo", max_len=MEMO_MAX)

    x, y = random_spawn()
    user = User(
        id=sid,
        name=safe_name,
        character=safe_char,
        color=safe_color,
        x=x,
        y=y,
        direction="right",
        memo=safe_memo,
    )
    room.users[sid] = user

    await sio.emit("state", _state_snapshot(room, user), to=sid)
    await sio.emit("userJoined", asdict(user), room=room.id, skip_sid=sid)
    return {"ok": True}


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
    # grace window so a quick redirect-out-and-back doesn't blow the room
    # away before the user returns. A late join cancels the task in on_join().
    if not room.users:
        schedule_eviction(room.id)


# ───────────────── Movement ─────────────────


@sio.on("move")
async def on_move(sid: str, payload: MovePayload) -> None:
    pair = await _authed_user(sid)
    if pair is None:
        return
    room, user = pair
    user.x = clamp(safe_float(payload, "x"), 0, ROOM_WIDTH)
    user.y = clamp(safe_float(payload, "y"), 0, ROOM_HEIGHT)
    direction = payload.get("direction")
    if direction in ("left", "right"):
        user.direction = direction
    await sio.emit(
        "userMoved",
        {"id": user.id, "x": user.x, "y": user.y, "direction": user.direction},
        room=room.id,
        skip_sid=sid,
    )


# ───────────────── Identity updates ─────────────────


@sio.on("updateCharacter")
async def on_update_character(sid: str, payload: UpdateCharacterPayload) -> None:
    await _update_user_field(sid, payload, "character", max_len=40)


@sio.on("updateName")
async def on_update_name(sid: str, payload: UpdateNamePayload) -> None:
    await _update_user_field(sid, payload, "name", max_len=NAME_MAX, strip=True)


@sio.on("updateColor")
async def on_update_color(sid: str, payload: UpdateColorPayload) -> None:
    await _update_user_field(sid, payload, "color", max_len=40)


@sio.on("updateMemo")
async def on_update_memo(sid: str, payload: UpdateMemoPayload) -> None:
    # Memo is clearable — empty string is a legitimate value.
    await _update_user_field(sid, payload, "memo", max_len=MEMO_MAX, allow_empty=True)


# ───────────────── Ambient ─────────────────


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
        clamped = safe_int(payload, "intensity", default=room.ambient.intensity, lo=0, hi=100)
        if clamped != room.ambient.intensity:
            room.ambient.intensity = clamped
            changed = True
    if not changed:
        return
    await sio.emit("ambientChanged", asdict(room.ambient), room=room.id)


# ───────────────── Playback ─────────────────


@sio.on("updatePlayback")
async def on_update_playback(sid: str, payload: UpdatePlaybackPayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    raw_uri = payload.get("trackUri")
    if raw_uri is None:
        track_uri: str | None = None
    else:
        track_uri = clean_uri(raw_uri)
    room.track_uri = track_uri
    room.is_playing = bool(payload.get("isPlaying", False))
    room.position_ms = safe_int(payload, "positionMs", lo=0)
    room.position_updated_at = time.time() * 1000
    await sio.emit(
        "playbackChanged",
        _playback_snapshot(room),
        room=room.id,
        skip_sid=sid,
    )


# ───────────────── Queue ─────────────────


@sio.on("addToQueue")
async def on_add_to_queue(sid: str, payload: AddToQueuePayload) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    uri = clean_uri(payload.get("uri"))
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
    new_uris = clean_uri_list(payload.get("uris"))
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
    cleaned = clean_uri_list(payload.get("uris"))
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
    uri = clean_uri(payload.get("uri"))
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
    expected = clean_uri(payload.get("afterTrackUri"))
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


# ───────────────── Chat (text + voice) ─────────────────


@sio.on("chat")
async def on_chat(sid: str, payload: ChatPayload) -> None:
    pair = await _authed_user(sid)
    if pair is None:
        return
    room, user = pair
    text = safe_string(payload, "text", max_len=MSG_MAX, strip=True)
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
    trim_history(room)
    await sio.emit("chatMessage", asdict(message), room=room.id)


@sio.on("voiceMessage")
async def on_voice_message(sid: str, payload: Mapping[str, Any]) -> None:
    pair = await _authed_user(sid)
    if pair is None:
        return
    room, user = pair
    audio = payload.get("audio")
    if not isinstance(audio, (bytes, bytearray)):
        return
    audio_bytes = bytes(audio)
    if not audio_bytes or len(audio_bytes) > MAX_VOICE_BYTES:
        return
    duration = safe_int(payload, "durationMs", default=0, lo=0, hi=MAX_VOICE_DURATION_MS)
    if duration <= 0:
        return
    mime = safe_string(payload, "mime", max_len=64)
    if mime not in ALLOWED_VOICE_MIMES:
        return
    message = ChatMessage(
        id=str(uuid.uuid4()),
        userId=user.id,
        name=user.name,
        character=user.character,
        color=user.color,
        text="",
        timestamp=int(time.time() * 1000),
        kind="voice",
        audioDurationMs=duration,
        audioMime=mime,
    )
    room.messages.append(message)
    room.audio_blobs[message.id] = audio_bytes
    room.audio_total_bytes += len(audio_bytes)
    trim_history(room)
    expired_ids = enforce_audio_cap(room)
    if expired_ids:
        await sio.emit("audioExpired", {"ids": expired_ids}, room=room.id)
    await sio.emit("chatMessage", asdict(message), room=room.id)
