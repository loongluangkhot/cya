"""Permissive runtime sanitization for socket.io payloads.

Handlers in ``events.py`` route every payload field through one of these
helpers. The contract is "return a safe value; never raise" — malformed
client messages are silently dropped at the call site, not here.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

_YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def safe_string(
    payload: Mapping[str, Any],
    key: str,
    *,
    default: str = "",
    max_len: int = 40,
    strip: bool = False,
) -> str:
    raw = str(payload.get(key) or default)[:max_len]
    return raw.strip() if strip else raw


def safe_int(
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


def safe_float(payload: Mapping[str, Any], key: str, default: float = 0.0) -> float:
    try:
        return float(payload.get(key) or default)
    except (TypeError, ValueError):
        return default


def clean_uri(raw: Any) -> str | None:
    """Validate a YouTube video id. Stored under the legacy `track_uri`
    field name; semantically this is a YouTube 11-char id post-migration."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not _YT_ID_RE.match(s):
        return None
    return s


def clean_uri_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for r in raw:
        u = clean_uri(r)
        if u:
            out.append(u)
    return out
