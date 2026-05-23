# cya

A tamagotchi-style virtual hangout. Pick a buddy, walk around the LCD room with arrow keys, and chat with friends. Each message floats above your sprite as a speech bubble and appears in the side chat panel.

## Stack

- **server** — Node.js, Express, Socket.io
- **client** — React + Vite, vanilla CSS (no asset files; sprites are pure CSS pixel-art)

## Setup

```bash
npm run install:all
```

## Develop

```bash
npm run dev
```

- Server listens on `http://localhost:3001`
- Client dev server on `http://localhost:5173`

Open multiple browser tabs/windows at `http://localhost:5173` to test multi-user.

## Production / deploy

```bash
npm run build   # builds client into client/dist
npm start       # express serves client/dist + sockets on PORT (default 3001)
```

Anything that runs Node (Render, Fly, Railway, a small VPS) works. The server statically serves the built client; one port, one process.

Set `PORT` via env var on your host. Friends join by visiting the URL.

## Controls

- **Arrow keys** or **WASD** — walk
- **Type in chat panel + Enter** — send a message (also pops as a bubble over your sprite)
