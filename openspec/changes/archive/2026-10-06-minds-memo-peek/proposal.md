# Proposal

## Why

Minds memos are meant to start conversations, but people rarely see them. The ✺ dock glyph never changes, the note icon over a sprite has to be tapped, and editing a memo makes no visible change for anyone else. Memos end up sitting unread in a sheet nobody opens.

## What Changes

- Every so often, an active user's memo sticky (the "on my mind" note above their sprite) pops open on its own as a **peek**: it stays for a few seconds, then fades. There's no backdrop, so the scene stays usable underneath.
- One peek at a time. Users take turns, so the scene stays calm.
- A user whose memo just changed is next in line, so a fresh memo appears soon without a separate "updated" notice.
- Speech bubbles (chat and voice) take priority over a peek. A peek never covers something someone just said.
- A peek is the same sticky preview the note icon opens: same size, scrolling and "see more →". It just closes by itself. Touching it in any way keeps it open. The sticky is the only way a memo appears in the scene.
- The memo preview is translucent, turning opaque while hovered or once touched. It shows up to four lines and scrolls for the rest, and has a close button. "see more →" opens the Minds sheet with everyone's memos.
- An on/off toggle in the Minds sheet header turns peeks off for the viewer only, in the same style as the other sheets' toggles. The setting is saved locally and defaults to on.
- The memo editor gets a short hint that the note pops up above you now and then.
- Peek timing defaults to 60–90s gaps, a 10–20s first peek and an ~8s peek. Each can be overridden at build time with optional `VITE_MEMO_PEEK_*` env vars, for example to speed up local testing.
- The dock's on/off buttons (minds, music, mugshot, marquee) share one style: filled when on, plain when off, same icon in both states, and "name · on/off" on hover. This also changes the existing buttons: marquee fills whenever it's on (not only while its strip shows), mugshot drops its dashed off icon, and the off-state dimming is removed.
- Each client picks peeks on its own. Viewers may see different peeks at the same moment. No server or protocol changes.

## Capabilities

### New Capabilities
- `memo-peek`: Periodic, self-dismissing peeks of users' memo stickies in the room scene. Covers turn-taking, priority against speech bubbles, tap-to-pin, a translucent four-line scrolling preview with a close button, and a per-viewer mute.
- `room-dock`: How the room dock's on/off buttons show their state, by fill and on hover.

### Modified Capabilities
<!-- None: no existing specs in openspec/specs/. -->

## Impact

- **Frontend only** (`frontend/src`):
  - `components/scene/PeerOnIso.tsx`: one memo preview with a peek state (auto, fading, no backdrop) and a pinned state. It's translucent, four lines with scrolling, and has a close button
  - `components/IsoScene.tsx`: runs the rotation and passes the peeking user down. Touching a peek pins it through the existing `previewMemoId`, and × closes or dismisses it
  - new rotation hook `hooks/useThoughtRotation.ts`, fed by `users` and `bubbles` from `useRoomState`, with env-configurable timing
  - new `memo.ts`: markdown-aware "memo has text" check (`extractHeadline`)
  - `components/Room.tsx`: mute state via `useStoredState`, wiring into `IsoScene`, `MindsSheet` and `RoomDock`
  - `components/room/RoomDock.tsx`: on/off fill and hover text for minds, music, mugshot and marquee
  - `components/sheets/MindsSheet.tsx`: on/off header toggle
  - `components/sheets/MemoEditorSheet.tsx`: hint line
  - `styles/app.css`: peek animation, preview translucency, four-line scroll and close button, removal of `.dock-glyph.is-off`
  - `vite-env.d.ts`, `.env.example`: the `VITE_MEMO_PEEK_*` variables
- **Backend**: no changes. Memo text and user `status` already reach clients through existing events.
- **Dependencies**: none added.
