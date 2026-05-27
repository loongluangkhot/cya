"""TypedDict shapes for socket.io payloads.

These document the wire protocol the client sends. They give static type-check
benefit at handler entry; we still run each payload through the ``_safe_*``
helpers in ``main.py`` for permissive runtime sanitization, so a malformed
client message is silently dropped instead of raising.
"""

from __future__ import annotations

from typing import Literal, TypedDict

# Ambient enum values — single backend source of truth.
# Kept in sync with the matching union types in frontend/src/types.ts
# (AmbientTime, AmbientWeather, AmbientRoom — look for the @sync marker).
AMBIENT_TIMES: tuple[str, ...] = ("dawn", "day", "dusk", "night")
AMBIENT_WEATHERS: tuple[str, ...] = ("clear", "rain", "snow", "fog")
AMBIENT_ROOMS: tuple[str, ...] = ("clearing", "plaza")


class JoinPayload(TypedDict, total=False):
    roomId: str
    name: str
    character: str
    color: str
    memo: str


class MovePayload(TypedDict, total=False):
    x: float
    y: float
    direction: Literal["left", "right"]


class UpdateCharacterPayload(TypedDict, total=False):
    character: str


class UpdateNamePayload(TypedDict, total=False):
    name: str


class UpdateColorPayload(TypedDict, total=False):
    color: str


class UpdateMemoPayload(TypedDict, total=False):
    memo: str


class UpdatePlaybackPayload(TypedDict, total=False):
    trackUri: str | None
    isPlaying: bool
    positionMs: int


class AddToQueuePayload(TypedDict, total=False):
    uri: str


class AddManyToQueuePayload(TypedDict, total=False):
    uris: list[str]


class PlayCollectionPayload(TypedDict, total=False):
    uris: list[str]


class RemoveFromQueuePayload(TypedDict, total=False):
    uri: str
    index: int


class AdvanceQueuePayload(TypedDict, total=False):
    afterTrackUri: str | None


class UpdateAmbientPayload(TypedDict, total=False):
    time: Literal["dawn", "day", "dusk", "night"]
    weather: Literal["clear", "rain", "snow", "fog"]
    room: Literal["clearing", "plaza"]
    intensity: int


class ChatPayload(TypedDict, total=False):
    text: str


# Outgoing wire shape — emitted in `state` and `playbackChanged`.
# @sync: frontend/src/types.ts:PlaybackState
class PlaybackSnapshot(TypedDict):
    trackUri: str | None
    isPlaying: bool
    positionMs: int
    positionUpdatedAt: float
