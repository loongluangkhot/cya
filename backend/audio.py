"""Voice-message storage policy: history trimming + per-room byte cap.

Voice clips live in ``Room.audio_blobs`` keyed by ``ChatMessage.id``. Two
mechanisms keep the dict bounded:

1. ``trim_history`` drops oldest messages beyond ``MAX_HISTORY`` and
   removes any audio blobs tied to them in one pass.
2. ``enforce_audio_cap`` runs after each new clip lands; it walks the
   message list oldest-first dropping voice blobs until the total fits
   under ``AUDIO_CAP_BYTES``. Expired rows stay in the chat log but flip
   ``audioExpired`` so the client can render a disabled state. Returns
   the list of newly-expired ids for the caller to broadcast.
"""

from __future__ import annotations

from config import AUDIO_CAP_BYTES, MAX_HISTORY
from models import Room


def trim_history(room: Room) -> None:
    """Drop oldest messages beyond MAX_HISTORY, cleaning up any audio
    blobs tied to them as we go."""
    while len(room.messages) > MAX_HISTORY:
        gone = room.messages.pop(0)
        blob = room.audio_blobs.pop(gone.id, None)
        if blob is not None:
            room.audio_total_bytes -= len(blob)


def enforce_audio_cap(room: Room) -> list[str]:
    """FIFO-evict voice blobs until total is under cap. Returns ids of
    messages that newly flipped ``audioExpired`` — caller emits the
    ``audioExpired`` socket event with them."""
    expired_ids: list[str] = []
    for msg in room.messages:
        if room.audio_total_bytes <= AUDIO_CAP_BYTES:
            break
        if msg.kind != "voice" or msg.audioExpired:
            continue
        blob = room.audio_blobs.pop(msg.id, None)
        if blob is None:
            continue
        room.audio_total_bytes -= len(blob)
        msg.audioExpired = True
        expired_ids.append(msg.id)
    return expired_ids
