# Design

## Context

See proposal.md for the why. The pieces this builds on:

- `useRoomState` already has `users` (each with `memo` and `status`) and `bubbles: Record<userId, BubbleState>`. Speech bubbles are client-only and expire after `BUBBLE_MS = 4500`.
- `IsoScene` owns `previewMemoId`, the pinned memo popover. When it's set, a full-scene `.memo-note-backdrop` dismisses it on any outside pointer-down. `PeerOnIso` renders `.memo-note-preview` above the sprite (`max-height: 7.5em`, bottom fade mask, "see more →"). The preview already stops click and pointer-down from reaching the scene, so it doesn't start a pan.
- `onUserUpdated` silently replaces `memo` on a user, so a memo change can be seen by comparing the current memo to the last one recorded per user.
- `useStoredState` plus `validateBool` already store per-viewer booleans in `Room.tsx`. Sheets show their on/off as a header `sheet-toggle` with plain "on"/"off" text.
- The frontend has no test runner. Checks are `npm run typecheck`/`build` and manual testing with `make dev`.

## Goals / Non-Goals

**Goals:**
- One memo surface in the scene: the existing sticky, with three states (closed, peek, pinned).
- Keep scheduling in one hook, separate from rendering.

**Non-Goals:**
- Showing the same peek to everyone at once. This would need a server timer per room.
- Adding a test framework to the frontend.
- Changing the MindsSheet layout, apart from the header toggle.
- Changing dock button icons. Only their on/off fill and hover text change (§12).

## Decisions

**1. `useThoughtRotation` hook decides who peeks, `IsoScene` passes it to `PeerOnIso`.**
Inputs: `users`, `bubbles`, `previewMemoId`, `muted`. Output: `{ thought: { userId } | null, dismiss }`, where `dismiss()` ends the current peek early (see §7a). `IsoScene` passes `peeking={thought?.userId === p.id}` to each `PeerOnIso`. The hook name stays as it is: it's internal, and "thought" still describes what it schedules.
*Alternative considered:* a separate cloud `ThoughtBubble` element (the first version). Dropped because it put two memo surfaces over each head.

**2. Timing: a single `setTimeout` chain.**
After each peek, or a skipped tick, schedule the next one 60–90s later (uniform random). A peek lasts about 8s (`THOUGHT_SHOW_MS`), longer than a one-line bubble because the sticky has more text. The first peek after joining comes after 10–20s. When the tab is hidden, clear the timers and hide the peek. When it's visible again, schedule the next one 60–90s later.

**3. Turn order kept in refs: `lastShownAt: Map`, `priority: string[]`.**
Eligible means: status `online`, the memo has text, no speech bubble, preview not open. Pick the first eligible user in `priority`, otherwise the one with the oldest `lastShownAt`, breaking ties at random.

**4. Memo changes seen by comparison** (`lastMemo` ref). A new memo with text moves the user to the front of `priority`. A memo cleared to empty takes them out of the rotation. First sight of a user only records their memo.

**5. The hook drops a peek as soon as its user stops qualifying.** That means speaking, going away, clearing their memo, leaving, or getting pinned. The peek isn't brought back afterwards.

**6. "Has text" check uses `extractHeadline(memo) !== ''`.** The existing pure function in `src/memo.ts` already removes markdown symbols, so a memo that's only `---` doesn't peek. Its other use (showing a one-line headline) is gone, but the function stays because it's the right emptiness test.

**7. Peek and pinned are one element in `PeerOnIso`.**
- The preview renders when `previewOpen || peeking`. It has the same markup, size, scroll and "see more →" in both states. The only extra while peeking is `is-peek`, which adds the `memo-peek-life` fade (fade in, hold, fade out over `--peek-ms`).
- Any pointer-down or wheel on a peek pins it (`onTogglePreview`, which sets `previewMemoId`). Removing `is-peek` stops the fade, and the hook drops the peek because the preview is now open. The box stays where it is, so nothing visibly swaps. Pinning on pointer-down rather than click means starting a scroll also keeps it open, and tapping "see more →" still works, since pointer-down pins and the click then opens the sheet.
- Scroll styles apply in both states: the four-line `max-height` from §7a, `overflow-y: auto`, `overscroll-behavior: contain`, `touch-action: pan-y`, no fade mask. The existing pointer-down `stopPropagation` keeps a scroll from becoming a scene pan.
- The backdrop follows `previewMemoId` only, so a peek never adds one. It appears once the peek is pinned, as with any opened preview.
- *Alternative considered:* a compact, non-scrolling peek (the previous version). Dropped because it read as a second component, and it could fade out mid-scroll.

**7a. Preview polish: translucent, close button, four lines.**
- Background: `color-mix(in srgb, var(--surface) 78%, transparent)`, so it follows the theme. No blur, so the scene behind stays recognizable. The border and hard shadow stay, which keeps the box readable as a box.
- Opaque while being read: `:hover` and `:focus-within` switch the background to `var(--surface)`. Touch screens have no hover, so under `@media (hover: none)` an opened preview (`:not(.is-peek)`) is opaque. That fits because touching a peek opens it.
- Four lines: the memo body's `max-height` is `calc(1.4em * 4)`, matching its `line-height`, and it scrolls past that. Markdown margins can make the visible part slightly less than four full lines. That's acceptable.
- Close button: an × (`Icon name="x"`) at the right of the "on my mind" label row. Its pointer-down stops propagation, so it doesn't count as a touch that keeps a peek open. Clicking it calls `onClosePreview`. In `IsoScene` that sets `previewMemoId` to null when this preview is pinned, or otherwise calls the hook's new `dismiss()`, which clears the current peek without changing the timers.

**8. Remove `ThoughtBubble`.** Delete `components/scene/ThoughtBubble.tsx` and the `.thought*` CSS from the first version.

**9. Mute toggle.** Stored as `THOUGHTS_ON_KEY` in `Room.tsx` (default true). It's a `sheet-toggle` in the MindsSheet header showing "on"/"off", like Music, Marquee and Mugshot. The aria-label and hover title name what it controls.

**10. Editor hint.** One muted mono line under the textarea: "your note pops up above you now and then".

**11. Timing from optional env vars.** `VITE_MEMO_PEEK_GAP_S` and `VITE_MEMO_PEEK_FIRST_S` take a `min-max` range in seconds (a single number means a fixed value), and `VITE_MEMO_PEEK_SHOW_S` takes seconds. A value that is unset, can't be parsed, or isn't positive falls back to the default (60–90, 10–20, 8). Vite fixes these values at build time or dev-server start, so they suit local testing and per-deploy adjustment, not changing timing on a running site. Speeding up peeks for testing then needs no code change.

**12. Dock on/off styling (`RoomDock.tsx`).** The ✺ button gets the Minds on/off state for its hover text ("minds · on/off") and fill. All on/off dock buttons now follow one rule: `is-active` (filled) when on, nothing when off, and the same icon in both states. Off-state dimming (`.dock-glyph.is-off`) is removed everywhere because it was barely visible. `MugshotGlyph` always renders its ring and dot, and the countdown arc is empty when opted out. Marquee's "on" follows its opt-in rather than whether the strip is showing. Its hover text still says "strip hidden".
*Alternative considered:* dim when off. Rejected after trying it, because the muted color was too subtle to read.

## Risks / Trade-offs

- [The sticky covers more of the scene than a one-line bubble, especially on phones] → Only one at a time, it fades on its own, there's no backdrop, and there are 60–90s gaps. The constants can be adjusted.
- [Touch-scrolling inside the memo preview turns into a scene pan or page bounce on iOS] → `touch-action: pan-y`, `overscroll-behavior: contain`, plus the existing pointer-down `stopPropagation`. Check on iOS Safari.
- [A changed memo jumps the queue on every save] → The gap between peeks limits it. Low stakes among friends.

## Migration Plan

Frontend-only, nothing to migrate. To roll back, revert the commit. The leftover localStorage key does no harm.
