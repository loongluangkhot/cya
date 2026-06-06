# cya

A shared room for a while.

cya is a small, pixel-art hangout you spin up with a link and tear down by leaving. Friends drop into the same little LCD scene, walk a sprite around, and sit around the same music, the same light, the same nothing. No accounts, no profiles, no history — when the last person closes the tab, the room is gone.

The vibe is closer to a Tamagotchi screen than a chat app: low-stakes, ambient, a place to be together while you do something else. It's built to feel cozy on a phone next to you and forgettable in the best way.

## Stack

- **backend** — Python, FastAPI, python-socketio, uvicorn
- **frontend** — React + Vite + TypeScript, hand-rolled CSS pixel-art

## Run it

```bash
make install   # uv sync + npm install
make dev       # backend on :8001, frontend on :3001
```

Open `http://localhost:3001`, make a room, share the link.
