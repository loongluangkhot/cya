"""Environment-driven configuration and tunables.

All ``CYA_*`` env reads, hard caps, and derived constants live here.
Importing this module triggers ``load_dotenv`` so any other module can
call ``os.getenv`` later without worrying about ordering.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend dir before any os.getenv() runs.
load_dotenv(Path(__file__).parent / ".env")


# ───────────────── Hard-coded caps ─────────────────

ROOM_WIDTH = 1280
ROOM_HEIGHT = 720
MAX_HISTORY = 100
NAME_MAX = 20
MSG_MAX = 200
MEMO_MAX = 1000
QUEUE_MAX = 200

# Mugshot interval bounds — server clamps any client-supplied value into
# this range so a malformed payload can't disable prompts or DoS the room
# with sub-second cycles.
MUGSHOT_INTERVAL_MIN_S = 60
MUGSHOT_INTERVAL_MAX_S = 24 * 60 * 60

# Marquee tunables — hardcoded caps and refresh cadence. Refresh-per-feed
# is global (one TTL'd fetch shared across rooms via marquee.feed_cache),
# the per-room loop just diffs the cache against room.marquee_items.
MARQUEE_REFRESH_S = 5 * 60
MARQUEE_FEED_MAX_PER_ROOM = 10
MARQUEE_ITEMS_CAP = 30
MARQUEE_FETCH_TIMEOUT_S = 8
MARQUEE_URL_MAX_LEN = 500
MARQUEE_TITLE_MAX_LEN = 200
MARQUEE_DESCRIPTION_MAX_LEN = 1000


# ───────────────── Env helpers ─────────────────


def _env_int(key: str, default: int) -> int:
    """Read a positive int from os.environ. Empty/invalid/non-positive
    values fall back to the default — we never want a malformed env var
    to silently disable a cap or eviction policy."""
    raw = os.getenv(key, "").strip()
    if not raw:
        return default
    try:
        n = int(raw)
    except ValueError:
        return default
    return n if n > 0 else default


def _cors_origins() -> list[str]:
    """Read CYA_CORS_ORIGINS as a comma-separated list. Defaults to ['*']
    for dev convenience; tighten in prod (e.g. https://cya.app,https://staging.cya.app)."""
    raw = os.getenv("CYA_CORS_ORIGINS", "").strip()
    if not raw:
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


# Suggested "try this" links shown in the music sheet's paste bar. One
# env var per slot — labels are product copy and stay in code; URLs come
# entirely from env. Slots whose env var is unset are omitted.
_YT_EXAMPLE_SLOTS: tuple[tuple[str, str], ...] = (
    ("a song", "CYA_YT_SONG_URL"),
    ("a stream", "CYA_YT_STREAM_URL"),
    ("a playlist", "CYA_YT_PLAYLIST_URL"),
)


def _yt_examples() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for label, env_key in _YT_EXAMPLE_SLOTS:
        url = (os.getenv(env_key, "") or "").strip()
        if url:
            out.append({"label": label, "url": url})
    return out


# ───────────────── Derived constants ─────────────────

# Voice-message limits. Single-clip caps protect against runaway uploads;
# the per-room AUDIO_CAP_BYTES backs the FIFO eviction policy.
MAX_VOICE_DURATION_MS = _env_int("CYA_VOICE_MAX_S", 60) * 1000
MAX_VOICE_BYTES = _env_int("CYA_VOICE_MAX_MB", 5) * 1024 * 1024
AUDIO_CAP_BYTES = _env_int("CYA_AUDIO_CAP_MB", 50) * 1024 * 1024

# Allow-list of audio MIME types we'll accept from the client. Browsers'
# MediaRecorder lands on one of these (Chrome/Firefox → webm/opus, Safari
# → mp4/aac). Stored as-is and echoed back on the audio fetch endpoint so
# clients can decode without sniffing.
ALLOWED_VOICE_MIMES: tuple[str, ...] = (
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/ogg",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mpeg",
)

# Grace window (seconds) after the last user disconnects before the room
# is evicted. Long enough to absorb an OAuth round-trip and typical
# mobile background-tab durations (phone call, screen lock, brief app
# switch) so the room is still there when the user returns.
ROOM_GRACE_S = _env_int("CYA_ROOM_GRACE_S", 30 * 60)

# Per-user grace window (seconds) after the last sid for a clientId
# disconnects before we broadcast `userLeft` and pop the user. Browsers
# freeze backgrounded tabs after ~5min on desktop and aggressively on
# mobile, so 30min absorbs a phone-pocket multitasking session without
# making peers see them flicker out.
USER_GRACE_S = _env_int("CYA_USER_GRACE_S", 30 * 60)

# Web Push (VAPID) — generate keys with:
#   python -c "from py_vapid import Vapid01; v = Vapid01(); v.generate_keys(); \
#       print('PRIV:', v.private_key_pem.decode()); print('PUB:', v.public_key_b64)"
# Without all three set, push fan-out is disabled (the rest of the app
# still works fine; users just don't get background notifications).
VAPID_PRIVATE_KEY = os.getenv("CYA_VAPID_PRIVATE_KEY", "").strip()
VAPID_PUBLIC_KEY = os.getenv("CYA_VAPID_PUBLIC_KEY", "").strip()
# Push services (Mozilla autopush especially) reject claims without a
# valid `sub`. mailto: URI or an HTTPS URL pointing at your contact page.
VAPID_CONTACT = os.getenv("CYA_VAPID_CONTACT", "mailto:admin@cya.local").strip()
PUSH_ENABLED: bool = bool(VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)

# Body text inside a push payload is capped to keep us under the
# browser's ~3KB push-message budget (some FCM endpoints reject larger).
PUSH_TEXT_MAX = 500

# Mugshot tunables — default per-room interval and per-photo byte cap.
MUGSHOT_INTERVAL_DEFAULT_S = _env_int("CYA_MUGSHOT_INTERVAL_S", 30 * 60)
MUGSHOT_MAX_BYTES = _env_int("CYA_MUGSHOT_MAX_KB", 200) * 1024

# Allow-list of mugshot MIME types. The client encodes to JPEG; we list
# webp/png too so a future encoder swap doesn't need a server update.
ALLOWED_MUGSHOT_MIMES: tuple[str, ...] = (
    "image/jpeg",
    "image/webp",
    "image/png",
)

CORS_ORIGINS = _cors_origins()
# socket.io accepts either '*' (single string) or a list of explicit origins.
CORS_ORIGINS_FOR_SIO: str | list[str] = (
    "*" if CORS_ORIGINS == ["*"] else CORS_ORIGINS
)

YT_EXAMPLES = _yt_examples()


def _marquee_default_feeds() -> list[str]:
    """Comma-separated CYA_MARQUEE_DEFAULT_FEED_URLS. Whitespace and empty
    entries are dropped. Order is preserved — the first URL gets seeded
    first into a fresh room's marquee_feeds list."""
    raw = os.getenv("CYA_MARQUEE_DEFAULT_FEED_URLS", "").strip()
    if not raw:
        return []
    return [u.strip() for u in raw.split(",") if u.strip()]


MARQUEE_DEFAULT_FEED_URLS = _marquee_default_feeds()
