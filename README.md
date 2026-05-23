# cya

A tamagotchi-style virtual hangout. Pick a buddy, walk around the LCD room with arrow keys, and chat with friends. Each message floats above your sprite as a speech bubble and appears in the side chat panel.

## Stack

- **server** — Python, FastAPI, python-socketio, uvicorn
- **client** — React + Vite, vanilla CSS (no asset files; sprites are pure CSS pixel-art)

## Prerequisites

- Node.js 18+ (for the client)
- Python 3.11+ and [`uv`](https://docs.astral.sh/uv/) (for the server) — install with `brew install uv` or `pipx install uv`

## Setup

```bash
npm run install:all
```

This installs the root tooling, the client's npm deps, and runs `uv sync` in `server/` to create a `.venv` with FastAPI + python-socketio + uvicorn.

## Develop

```bash
npm run dev
```

- Server (uvicorn) listens on `http://localhost:3001`
- Client (Vite) on `http://localhost:5173`

Open multiple browser tabs/windows at `http://localhost:5173` to test multi-user.

## Production / deploy

```bash
npm run build   # builds client into client/dist
npm start       # uvicorn serves client/dist + Socket.IO on port 3001
```

Anything that runs Python 3.11+ (Render, Fly, Railway, a small VPS) works. The server statically serves the built client; one port, one process.

To change the port, run `cd server && uv run uvicorn main:asgi_app --port <port>` directly. Friends join by visiting the URL.

## Controls

- **Arrow keys** or **WASD** — walk
- **Type in chat panel + Enter** — send a message (also pops as a bubble over your sprite)
