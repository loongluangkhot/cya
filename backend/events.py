"""socket.io event handlers.

Importing this module registers every ``@sio.on(...)`` handler via
decorator side effects. The handlers all share three concerns: resolve
the caller's room/user, sanitize the payload, mutate room state, then
broadcast the diff.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import Mapping
from dataclasses import asdict
from typing import Any

from app import sio
from audio import enforce_audio_cap, trim_history
from config import (
    ALLOWED_MUGSHOT_MIMES,
    ALLOWED_VOICE_MIMES,
    MAX_VOICE_BYTES,
    MAX_VOICE_DURATION_MS,
    MEMO_MAX,
    MSG_MAX,
    MUGSHOT_INTERVAL_MAX_S,
    MUGSHOT_INTERVAL_MIN_S,
    MUGSHOT_MAX_BYTES,
    NAME_MAX,
    PUSH_TEXT_MAX,
    QUEUE_MAX,
    ROOM_HEIGHT,
    ROOM_WIDTH,
    USER_GRACE_S,
)
from models import ChatMessage, MugshotBlob, Room, User
import mugshots
import push
from payloads import (
    AMBIENT_ROOMS,
    AMBIENT_TIMES,
    AMBIENT_WEATHERS,
    AddManyToQueuePayload,
    AddToQueuePayload,
    AdvanceQueuePayload,
    ChatPayload,
    ClientVisibilityPayload,
    JoinPayload,
    MovePayload,
    PlaybackSnapshot,
    PlayCollectionPayload,
    RemoveFromQueuePayload,
    SubmitMugshotPayload,
    SubscribePushPayload,
    UpdateAmbientPayload,
    UpdateCharacterPayload,
    UpdateColorPayload,
    UpdateMemoPayload,
    UpdateMugshotIntervalPayload,
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


async def _session_room_cid(sid: str) -> tuple[Room, str] | None:
    """Resolve (room, clientId) from a sid via its socket.io session.
    Returns None if the sid isn't joined to a room."""
    session = await sio.get_session(sid)
    if not session:
        return None
    room = rooms.get(session.get("roomId"))
    if room is None:
        return None
    cid = session.get("clientId")
    if not cid:
        return None
    return room, cid


async def _current_room(sid: str) -> Room | None:
    pair = await _session_room_cid(sid)
    return pair[0] if pair else None


async def _authed_user(sid: str) -> tuple[Room, User] | None:
    """Resolve (room, user) for the caller in one step. Returns None if
    the sid isn't joined to a room, has no clientId session yet, or the
    matching user has already been evicted."""
    pair = await _session_room_cid(sid)
    if pair is None:
        return None
    room, cid = pair
    user = room.users.get(cid)
    if user is None:
        return None
    return room, user


# ───────────────── Presence helpers ─────────────────


def _aggregate_status(room: Room, cid: str) -> str:
    """Online if any live sid for this clientId reports visible; away
    otherwise (all sids hidden, or no live sids during the grace window).

    Defaulting `sid_visible` to True for any unknown sid means a fresh
    join is treated as online from the moment it arrives — we don't
    wait for the first `clientVisibility` event. The next visibility
    tick corrects it if the assumption is wrong.
    """
    sids = room.client_to_sids.get(cid)
    if not sids:
        return "away"
    for sid in sids:
        if room.sid_visible.get(sid, True):
            return "online"
    return "away"


async def _broadcast_status_if_changed(room: Room, cid: str) -> None:
    user = room.users.get(cid)
    if user is None:
        return
    new_status = _aggregate_status(room, cid)
    if new_status == user.status:
        return
    user.status = new_status
    await sio.emit(
        "userStatusChanged",
        {"id": cid, "status": new_status},
        room=room.id,
    )


async def _cleanup_user_later(room: Room, cid: str, seq: int) -> None:
    """Fired USER_GRACE_S after the last sid for `cid` disconnects.
    Re-validates `reconnect_seq` inside the room lock before mutating
    — so a late reconnect's `cancel()` racing with our wakeup is a
    benign no-op rather than a double-eviction or zombie user.

    The `sio.emit('userLeft', ...)` happens *inside* the lock too: if
    it lived outside, a reconnect could squeeze in between the pop and
    the emit, peers would see a stale userLeft for the just-rejoined
    user and remove them from their lists. Sending under the lock
    serializes against on_join's userJoined emit, so peers always see
    a consistent userLeft → userJoined ordering."""
    try:
        await asyncio.sleep(USER_GRACE_S)
    except asyncio.CancelledError:
        return
    schedule_eviction_after = False
    async with room.lock:
        # The user reconnected during the sleep — bail.
        if room.reconnect_seq.get(cid) != seq:
            return
        if room.client_to_sids.get(cid):
            return
        user = room.users.pop(cid, None)
        room.client_to_sids.pop(cid, None)
        room.reconnect_seq.pop(cid, None)
        room.mugshots.pop(cid, None)
        room.pending_user_cleanups.pop(cid, None)
        room.push_subscriptions.pop(cid, None)
        if user is None:
            return
        await sio.emit("userLeft", {"id": cid}, room=room.id)
        schedule_eviction_after = not any(
            sids for sids in room.client_to_sids.values()
        )
    if schedule_eviction_after:
        schedule_eviction(room.id)


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
        "mugshotIntervalS": room.mugshot_interval_s,
        "nextMugshotAt": room.next_mugshot_at,
        # Only the takenAt timestamp is needed in state — the bytes are
        # fetched lazily over HTTP at /api/rooms/{room}/mugshot/{user},
        # cache-busted by the takenAt query param.
        "mugshotsTakenAt": {uid: m.taken_at for uid, m in room.mugshots.items()},
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
    await sio.emit("userUpdated", {"id": user.id, key: safe}, room=room.id)


# ───────────────── Join / disconnect ─────────────────


@sio.on("join")
async def on_join(sid: str, payload: JoinPayload) -> dict[str, Any]:
    room_id = str(payload.get("roomId") or "")
    room = rooms.get(room_id)
    if room is None:
        return {"ok": False, "error": "room_not_found"}

    # Reconnecting before the grace window expires keeps the room alive.
    cancel_pending_eviction(room.id)

    safe_name = (
        safe_string(payload, "name", default="Guest", max_len=NAME_MAX, strip=True)
        or "Guest"
    )
    safe_char = safe_string(payload, "character", default="chef", max_len=40)
    safe_color = safe_string(payload, "color", default="leaf", max_len=40)
    safe_memo = safe_string(payload, "memo", max_len=MEMO_MAX)

    # ClientId is the stable cross-session identity. Old clients without
    # it get a server-minted fallback per connection — they keep working
    # but lose the reconnect/mugshot-persistence benefits.
    raw_cid = safe_string(payload, "clientId", max_len=64, strip=True)
    cid = raw_cid if raw_cid else f"legacy-{uuid.uuid4().hex[:16]}"

    is_reconnect = False
    user: User
    # Identity fields that changed on a reconnect; emitted to peers
    # outside the lock so they don't keep displaying stale name/etc.
    identity_diff: dict[str, str] = {}
    async with room.lock:
        await sio.save_session(sid, {"roomId": room.id, "clientId": cid})
        await sio.enter_room(sid, room.id)

        if cid in room.users:
            # Reconnect — preserve User entry (and its mugshot), refresh
            # editable identity fields from the latest payload (the user
            # may have updated their name/avatar on another tab).
            is_reconnect = True
            user = room.users[cid]
            if user.name != safe_name:
                identity_diff["name"] = safe_name
                user.name = safe_name
            if user.character != safe_char:
                identity_diff["character"] = safe_char
                user.character = safe_char
            if user.color != safe_color:
                identity_diff["color"] = safe_color
                user.color = safe_color
            if user.memo != safe_memo:
                identity_diff["memo"] = safe_memo
                user.memo = safe_memo
            # Cancel any pending grace cleanup; re-validation inside the
            # task is the real authoritative check.
            pending = room.pending_user_cleanups.pop(cid, None)
            if pending is not None:
                pending.cancel()
        else:
            x, y = random_spawn()
            user = User(
                id=cid,
                name=safe_name,
                character=safe_char,
                color=safe_color,
                x=x,
                y=y,
                direction="right",
                memo=safe_memo,
            )
            room.users[cid] = user

        room.client_to_sids.setdefault(cid, set()).add(sid)
        # Default new sid to visible — "online on first join" without
        # waiting for the first clientVisibility tick.
        room.sid_visible[sid] = True
        room.reconnect_seq[cid] = room.reconnect_seq.get(cid, 0) + 1

    # Status flips outside the lock to keep the critical section tight.
    await _broadcast_status_if_changed(room, cid)

    await sio.emit("state", _state_snapshot(room, user), to=sid)
    if not is_reconnect:
        # Only announce userJoined for truly new identities; a returning
        # client's peers never saw them leave (they were just "away").
        await sio.emit("userJoined", asdict(user), room=room.id, skip_sid=sid)
        # First-time mugshot prompt only when there's no existing photo.
        # Reconnects skip this — their previous mugshot is still on file.
        if cid not in room.mugshots:
            await sio.emit("mugshotPrompt", {"nextAt": room.next_mugshot_at}, to=sid)
    elif identity_diff:
        # Reconnect with edits — peers need to know so they don't keep
        # showing the old name / avatar / memo.
        await sio.emit(
            "userUpdated",
            {"id": cid, **identity_diff},
            room=room.id,
            skip_sid=sid,
        )
    return {"ok": True}


@sio.on("disconnect")
async def on_disconnect(sid: str) -> None:
    pair = await _session_room_cid(sid)
    if pair is None:
        return
    room, cid = pair

    last_sid_gone = False
    async with room.lock:
        sids = room.client_to_sids.get(cid)
        if sids is not None:
            sids.discard(sid)
        room.sid_visible.pop(sid, None)
        if not sids:
            last_sid_gone = True
            room.client_to_sids.pop(cid, None)
            # Don't pop the user yet — schedule grace cleanup. Bump
            # reconnect_seq so any in-flight cleanup we just cancelled
            # would no-op even if its cancel() lost the race.
            seq = room.reconnect_seq.get(cid, 0) + 1
            room.reconnect_seq[cid] = seq
            room.pending_user_cleanups[cid] = asyncio.create_task(
                _cleanup_user_later(room, cid, seq)
            )

    # Status flip lives outside the lock.
    await _broadcast_status_if_changed(room, cid)

    if last_sid_gone and not any(
        sids for sids in room.client_to_sids.values()
    ):
        # No one has any live sid in the room any more — schedule the
        # room-eviction grace on top of the per-user grace. The two
        # stack: per-user grace pops the user object, room grace then
        # frees the room itself if nobody returned.
        schedule_eviction(room.id)


@sio.on("clientVisibility")
async def on_client_visibility(
    sid: str, payload: ClientVisibilityPayload
) -> None:
    pair = await _session_room_cid(sid)
    if pair is None:
        return
    room, cid = pair
    visible = bool(payload.get("visible", False))
    async with room.lock:
        if sid not in room.sid_visible:
            return
        if room.sid_visible[sid] == visible:
            return
        room.sid_visible[sid] = visible
    await _broadcast_status_if_changed(room, cid)


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
    # Background push to away peers. We compute status fresh from
    # sid_visible rather than read the cached `u.status` field — the
    # cached value is updated outside room.lock and can lag a visibility
    # transition by a tick, which would silently skip a push to a user
    # who just backgrounded their tab. The SW additionally routes to
    # in-app toast for visible-on-this-room tabs, so duplication is
    # benign; the filter here just saves push traffic.
    away_cids = [
        cid
        for cid in room.users
        if cid != user.id
        and _aggregate_status(room, cid) == "away"
        and cid in room.push_subscriptions
    ]
    if away_cids:
        push.spawn(
            push.fan_out(
                room,
                {
                    "kind": "message",
                    "roomId": room.id,
                    "fromName": user.name,
                    "text": text[:PUSH_TEXT_MAX],
                    "messageId": message.id,
                },
                target_cids=away_cids,
            )
        )


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
    away_cids = [
        cid
        for cid in room.users
        if cid != user.id
        and _aggregate_status(room, cid) == "away"
        and cid in room.push_subscriptions
    ]
    if away_cids:
        push.spawn(
            push.fan_out(
                room,
                {
                    "kind": "voice",
                    "roomId": room.id,
                    "fromName": user.name,
                    "messageId": message.id,
                },
                target_cids=away_cids,
            )
        )


# ───────────────── Mugshots ─────────────────


@sio.on("submitMugshot")
async def on_submit_mugshot(sid: str, payload: SubmitMugshotPayload) -> None:
    pair = await _authed_user(sid)
    if pair is None:
        return
    room, user = pair
    image = payload.get("image")
    if not isinstance(image, (bytes, bytearray)):
        return
    image_bytes = bytes(image)
    if not image_bytes or len(image_bytes) > MUGSHOT_MAX_BYTES:
        return
    mime = safe_string(payload, "mime", max_len=64)
    if mime not in ALLOWED_MUGSHOT_MIMES:
        return
    taken_at = int(time.time() * 1000)
    room.mugshots[user.id] = MugshotBlob(data=image_bytes, mime=mime, taken_at=taken_at)
    await sio.emit(
        "mugshotSubmitted",
        {"userId": user.id, "takenAt": taken_at},
        room=room.id,
    )


@sio.on("updateMugshotInterval")
async def on_update_mugshot_interval(
    sid: str, payload: UpdateMugshotIntervalPayload
) -> None:
    room = await _current_room(sid)
    if room is None:
        return
    new_s = safe_int(
        payload,
        "intervalS",
        default=room.mugshot_interval_s,
        lo=MUGSHOT_INTERVAL_MIN_S,
        hi=MUGSHOT_INTERVAL_MAX_S,
    )
    if new_s == room.mugshot_interval_s:
        return
    room.mugshot_interval_s = new_s
    # Re-anchor the next prompt relative to now so a shorter interval
    # doesn't immediately fire (and a longer one doesn't make people wait
    # past the old deadline).
    room.next_mugshot_at = time.time() * 1000 + new_s * 1000
    mugshots.restart(room.id)
    await sio.emit(
        "mugshotIntervalChanged",
        {"intervalS": new_s, "nextAt": room.next_mugshot_at},
        room=room.id,
    )


# ───────────────── Push subscriptions ─────────────────


def _is_valid_push_subscription(sub: object) -> bool:
    """Browser PushSubscriptions have endpoint:str + keys:{p256dh, auth}.
    Reject any payload missing the cryptographic keys — pywebpush would
    raise at send time, but the error path doesn't drop the bad sub
    (only WebPushException 404/410 does), so bad subs accumulate."""
    if not isinstance(sub, dict):
        return False
    endpoint = sub.get("endpoint")
    keys = sub.get("keys")
    if not isinstance(endpoint, str) or not endpoint.startswith("https://"):
        return False
    if not isinstance(keys, dict):
        return False
    return isinstance(keys.get("p256dh"), str) and isinstance(keys.get("auth"), str)


@sio.on("subscribePush")
async def on_subscribe_push(sid: str, payload: SubscribePushPayload) -> None:
    """Register a Web Push subscription against the caller's clientId.
    Auth comes from the socket session (cid is bound at join), so a
    peer can't hijack another user's subscription."""
    pair = await _authed_user(sid)
    if pair is None:
        return
    room, user = pair
    if not _is_valid_push_subscription(payload):
        return
    room.push_subscriptions[user.id] = dict(payload)


@sio.on("unsubscribePush")
async def on_unsubscribe_push(sid: str, *_args: Any) -> None:
    pair = await _authed_user(sid)
    if pair is None:
        return
    room, user = pair
    room.push_subscriptions.pop(user.id, None)
