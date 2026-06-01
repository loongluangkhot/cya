"""Process entry point.

Importing this module wires the whole app: the FastAPI + socket.io
instances live in ``app.py``, ``routes.py`` and ``events.py`` register
their handlers on import, this file registers the SPA fallback last
(so it doesn't shadow the API routes), and finally mounts socket.io's
ASGI app over FastAPI and exports ``asgi_app`` for uvicorn.
"""

from __future__ import annotations

from pathlib import Path

import socketio
from fastapi import HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from app import fastapi_app, sio

# Importing these modules registers their decorators against fastapi_app / sio.
import routes  # noqa: F401  – side-effect import
import events  # noqa: F401  – side-effect import


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
