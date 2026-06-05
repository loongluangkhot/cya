"""Dataclasses used both as in-memory state and as wire payloads.

These round-trip through ``dataclasses.asdict()`` straight into socket.io
emits, so the fields here must match the corresponding TypeScript
interfaces in ``frontend/src/types.ts`` (look for the
``@sync: backend/models.py:<Name>`` markers there).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any


# @sync: frontend/src/types.ts:User
@dataclass
class User:
    # Stable cross-session identifier (the client persists this in
    # localStorage). Used as the dict key in Room.users and as the
    # `userId` referenced by chat / mugshot / userMoved / userLeft.
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
    # "online" while any of the user's tabs reports the page as visible,
    # "away" while every tab is either hidden or disconnected. Driven by
    # `clientVisibility` events from the client + the disconnect grace
    # in events.py.
    status: str = "online"


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
# recent shot per user (keyed by clientId in Room.mugshots).
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
    # Users keyed by stable clientId. A user occupies one slot in this
    # dict regardless of how many tabs / sids they have open.
    users: dict[str, User] = field(default_factory=dict[str, User])
    # Live sids per clientId. A user is "connected" while any sid is
    # present; "fully disconnected" when the set is empty (triggers the
    # grace window in events.py).
    client_to_sids: dict[str, set[str]] = field(default_factory=dict[str, set[str]])
    # Per-sid visibility, reported by the client's `visibilitychange`
    # listener. Status is aggregated as: online if any sid is True,
    # away if all sids are False or the user has no live sids.
    sid_visible: dict[str, bool] = field(default_factory=dict[str, bool])
    messages: list[ChatMessage] = field(default_factory=list[ChatMessage])
    # Voice-message bytes keyed by ChatMessage.id. Capped at AUDIO_CAP_BYTES
    # via FIFO eviction (see audio._enforce_audio_cap).
    audio_blobs: dict[str, bytes] = field(default_factory=dict[str, bytes])
    audio_total_bytes: int = 0
    # Mugshot state. mugshot_interval_s drives the per-room background
    # task in mugshots.py; next_mugshot_at is the next prompt's ms
    # timestamp so the client can render a countdown. mugshots is keyed
    # by clientId so a refresh / reconnect keeps the existing photo.
    mugshot_interval_s: int = 1800
    next_mugshot_at: float = 0.0
    mugshots: dict[str, MugshotBlob] = field(default_factory=dict[str, MugshotBlob])
    # Web Push subscriptions keyed by clientId. Each value is the raw
    # browser PushSubscription object as a dict (endpoint, keys: {p256dh,
    # auth}). Dropped on grace cleanup, room eviction, or 410/404 from
    # the push service.
    push_subscriptions: dict[str, dict[str, Any]] = field(
        default_factory=dict[str, dict[str, Any]]
    )
    # Per-user grace cleanup tasks, keyed by clientId. On disconnect we
    # schedule one; on reconnect we cancel it (or it re-validates the
    # reconnect_seq inside the lock and no-ops). See events.py.
    pending_user_cleanups: dict[str, asyncio.Task[None]] = field(
        default_factory=dict[str, asyncio.Task[None]]
    )
    # Monotonic counter bumped on every (dis)connect for a clientId.
    # Cleanup tasks snapshot it at schedule time and re-check inside the
    # lock — if it's moved, the user reconnected and we no-op.
    reconnect_seq: dict[str, int] = field(default_factory=dict[str, int])
    # Per-room mutation lock for all client/sid/cleanup transitions.
    # Lazy-init via __post_init__ so unit tests creating bare Rooms
    # don't blow up if no event loop is running yet.
    _lock: asyncio.Lock | None = None

    @property
    def lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock
