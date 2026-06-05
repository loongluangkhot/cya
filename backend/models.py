"""Dataclasses used both as in-memory state and as wire payloads.

These round-trip through ``dataclasses.asdict()`` straight into socket.io
emits, so the fields here must match the corresponding TypeScript
interfaces in ``frontend/src/types.ts`` (look for the
``@sync: backend/models.py:<Name>`` markers there).
"""

from __future__ import annotations

from dataclasses import dataclass, field


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
    # "On My Mind" memo — markdown text the user carries between rooms.
    # Public to everyone in whichever room they're currently in.
    memo: str = ""


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
    # Voice messages have kind='voice' and carry duration/mime metadata.
    # The blob itself lives in Room.audio_blobs and is fetched via HTTP.
    # When the FIFO eviction policy drops the blob, audioExpired flips to
    # true so the chat log can render a disabled state.
    kind: str = "text"
    audioDurationMs: int = 0
    audioMime: str = ""
    audioExpired: bool = False


# @sync: frontend/src/types.ts:Ambient
@dataclass
class Ambient:
    time: str = "dawn"
    weather: str = "clear"
    room: str = "clearing"
    # 0..100. Multiplier on the weather overlay's opacity client-side.
    intensity: int = 70


# Latest mugshot for a single user in a room. Replaced on each new
# submission — we never keep history, the room only ever holds the most
# recent shot per user (keyed by sid in Room.mugshots).
@dataclass
class MugshotBlob:
    data: bytes
    mime: str
    # ms since epoch — also used as cache-buster on the client's <img> src.
    taken_at: int


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
    # Voice-message bytes keyed by ChatMessage.id. Capped at AUDIO_CAP_BYTES
    # via FIFO eviction (see audio._enforce_audio_cap).
    audio_blobs: dict[str, bytes] = field(default_factory=dict[str, bytes])
    audio_total_bytes: int = 0
    # Mugshot state. mugshot_interval_s drives the per-room background
    # task in mugshots.py; next_mugshot_at is the next prompt's ms
    # timestamp so the client can render a countdown. mugshots is keyed
    # by user sid; entries are dropped on disconnect.
    mugshot_interval_s: int = 1800
    next_mugshot_at: float = 0.0
    mugshots: dict[str, MugshotBlob] = field(default_factory=dict[str, MugshotBlob])
