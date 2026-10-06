# Tasks

## 1. Memo text check

- [x] 1.1 Add a pure `extractHeadline(memo, max = 40)` function in `src/memo.ts` (remove markdown, take the first non-empty line, cut short with `…`). Verify `npm run typecheck` passes.
- [x] 1.2 Check it against cases: `# today\nmore` → `today`, leading blank lines skipped, a `---` / `- [ ]` only line skipped (so a memo of only those reads as empty), long lines cut, `[link](url)` → `link`, `snake_case` kept. Remove any temporary code afterward.

## 2. Rotation hook

- [x] 2.1 Create `hooks/useThoughtRotation.ts` with timing constants (60–90s gap, 10–20s first delay) and the `setTimeout` chain from design §2. Verify typecheck passes.
- [x] 2.2 Change the hook's output to `{ userId } | null`, raise `THOUGHT_SHOW_MS` to ~8s, and use `extractHeadline(memo) !== ''` only as the "has text" check (design §1, §2, §6). Verify typecheck passes.
- [x] 2.3 Read peek timing from optional `VITE_MEMO_PEEK_GAP_S`, `VITE_MEMO_PEEK_FIRST_S` (`min-max` seconds) and `VITE_MEMO_PEEK_SHOW_S` (seconds), falling back to the defaults when unset or invalid (design §11). Type them in `vite-env.d.ts` and document them in `.env.example`. Verify typecheck passes, and that setting `VITE_MEMO_PEEK_GAP_S=5-8` in `frontend/.env` and restarting `make dev` makes peeks arrive every few seconds.
- [x] 2.4 Verify eligibility and turn order with two browser tabs, one active and one away: only the active user's memo peeks, and with three tabs, turns go round before repeating (design §3).
- [x] 2.5 Verify memo-change handling: editing a memo in tab B makes it the next peek in tab A. Clearing it removes B from the rotation and hides a showing peek (design §4).
- [x] 2.6 Verify speech priority and visibility: chatting from tab B during its peek in tab A hides the peek and shows the speech bubble. Switching tabs away for 2+ minutes and back shows no peek straight away (design §2, §5).

## 3. Sticky peek and pin

- [x] 3.1 Delete `components/scene/ThoughtBubble.tsx` and the `.thought*` CSS, and stop rendering it in `IsoScene` (design §8). Verify `grep -rn ThoughtBubble frontend/src` finds nothing and typecheck passes.
- [x] 3.2 In `IsoScene`, pass `peeking` to each `PeerOnIso`. In `PeerOnIso`, render the same preview (including "see more →") when `previewOpen || peeking`, add `is-peek` while only peeking, pin on pointer-down or wheel while peeking, and raise the z-index (design §7). Verify typecheck passes, and that a peek adds no backdrop, so tapping or panning the scene elsewhere still works while it shows.
- [x] 3.3 CSS: `memo-peek-life` fade for `.memo-note-preview.is-peek`, and scroll styles for every memo preview: the four-line max-height from 3.4, `overflow-y: auto`, `overscroll-behavior: contain`, `touch-action: pan-y`, no fade mask (design §7). Verify in the browser at phone width (~400px) and desktop: a peek and a clicked preview look identical, the peek fades in and out, touching or scrolling it keeps it open, and a long memo scrolls to the end without panning the scene.
- [x] 3.4 Translucent preview background, four visible lines (`max-height: calc(1.4em * 4)`) with scroll, and a close button that ends a peek via the hook's `dismiss()` or unpins an opened preview (design §7a). Verify typecheck passes, then in the browser: the scene shows through the box but turns opaque on hover (and once touched on a phone), a long memo shows four lines and scrolls, a short one has no scrollbar, × on a peek closes it without keeping it open, and × on an opened preview closes it.
- [x] 3.5 Verify a pinned preview's "see more →" opens the Minds sheet, and that your own memo also peeks above your sprite.

## 4. Mute toggle and editor hint

- [x] 4.1 In `Room.tsx`, add a `THOUGHTS_ON_KEY` and `useStoredState<boolean>(…, true, validateBool)`. Pass it to `IsoScene` as muted, and to `MindsSheet` as `thoughtsOn` / `onToggleThoughts`. Verify typecheck passes.
- [x] 4.2 Add a `sheet-toggle` on/off in the `MindsSheet` header, with the same text and style as Music, Marquee and Mugshot (design §9). Verify that turning it off removes a visible peek at once, stops new ones, stays off after reload and in another room, and that another tab still sees your peeks.
- [x] 4.3 Add the hint "your note pops up above you now and then" under the textarea in `MemoEditorSheet` (design §10). Verify it appears and doesn't push the save row off-screen on a phone.
- [x] 4.4 Dock on/off buttons in `RoomDock.tsx` (design §12, `room-dock` spec): the ✺ hover text reads "minds · on/off", and minds, music, mugshot and marquee are filled when on and plain when off, with the same icon in both states and no dimming. Verify by toggling each feature: the fill follows its on/off, marquee stays filled with the strip hidden, the mugshot icon doesn't change when opted out, and each hover reads "<name> · on/off".

## 5. Integration check

- [x] 5.1 Run `npm run build` (typecheck + vite build) and make sure it succeeds.
- [x] 5.2 Do a manual run-through with three tabs via `make dev`: peeks take turns without repeating early, only one shows at a time, an away user is skipped, a memo with no text never peeks, a changed memo goes next, and nothing runs while a tab is hidden.
