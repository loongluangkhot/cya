"""Shared FastAPI + socket.io instances.

Importing this module is the first step of app construction. ``routes.py``
and ``events.py`` import these instances to attach their decorators;
``main.py`` does the final ASGI mount and exports ``asgi_app``.
"""

from __future__ import annotations

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, CORS_ORIGINS_FOR_SIO

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=CORS_ORIGINS_FOR_SIO)

fastapi_app = FastAPI()
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
