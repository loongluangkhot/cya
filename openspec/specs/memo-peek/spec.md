# memo-peek Specification

## Purpose

Brings users' Minds memos into the room scene by occasionally popping open a user's memo sticky on its own, so memos get noticed and spark conversation without anyone opening the Minds sheet.

## Requirements

### Requirement: Periodic memo peeks
While the room is visible to the viewer, the client SHALL periodically show a peek of one present user's memo sticky above their sprite, by default about every 60–90 seconds with random variation. The peek SHALL disappear on its own after a few seconds. A deployment MAY configure these timings.

#### Scenario: Peek appears for a user with a memo
- **WHEN** a user in the room is active, has a memo with text, and the next peek is due
- **THEN** that user's memo sticky opens above their sprite as a peek and fades away after a few seconds

#### Scenario: No eligible users
- **WHEN** no present user is both active and has a memo with text
- **THEN** no peek is shown

#### Scenario: Tab hidden
- **WHEN** the room tab is hidden
- **THEN** no peeks are scheduled or shown until the tab is visible again

### Requirement: Peeks do not block the scene
A peek SHALL NOT add a backdrop or otherwise capture taps outside its own box. The viewer SHALL be able to move, tap other stickies, and pan the scene while a peek is visible.

#### Scenario: Tap elsewhere during a peek
- **WHEN** a peek is visible and the viewer taps or drags elsewhere in the scene
- **THEN** that interaction works as it would without the peek

### Requirement: Only active users peek
The client SHALL show peeks only for users whose status is active. Users marked away SHALL be skipped.

#### Scenario: Away user is skipped
- **WHEN** a user with a memo has status away
- **THEN** no peek is shown for that user

#### Scenario: User returns from away
- **WHEN** an away user with a memo becomes active again
- **THEN** that user can be picked for a peek again

### Requirement: Viewer's own memo peeks
The client SHALL include the viewing user in the rotation under the same rules as everyone else. The client SHALL NOT show any placeholder peek for a user whose memo has no text, including the viewer.

#### Scenario: Own memo peeks
- **WHEN** the viewer is active and has a memo with text
- **THEN** the viewer's own sticky occasionally peeks above their sprite

#### Scenario: Empty memo shows nothing
- **WHEN** the viewer's memo is empty or contains only markdown symbols with no text (for example `---`)
- **THEN** no peek or placeholder appears above the viewer's sprite

### Requirement: One peek at a time, taking turns
The client SHALL show at most one peek at any moment. It SHALL pick the eligible user whose memo peeked longest ago, or never, so every eligible user gets a turn before anyone repeats.

#### Scenario: Turns go around the room
- **WHEN** users A, B and C are eligible and A just peeked
- **THEN** the next peeks go to B and C before A again

#### Scenario: Single peek on screen
- **WHEN** a peek is visible
- **THEN** no other peek appears until it has disappeared

### Requirement: A changed memo goes next
When a user's memo changes to new text, the client SHALL make that user next in line, ahead of the usual turn order.

#### Scenario: Peer edits their memo
- **WHEN** an active peer saves a new memo with text
- **THEN** that peer's memo is the next one to peek

#### Scenario: Memo cleared
- **WHEN** a user's memo is changed to empty
- **THEN** that user is removed from the rotation, and any peek currently showing for them disappears

### Requirement: Speech takes priority over peeks
A speech bubble (chat or voice) SHALL always take priority over a peek for the same user.

#### Scenario: Peer speaks during their peek
- **WHEN** a peek is showing for a user and that user sends a chat or voice message
- **THEN** the peek disappears immediately and the speech bubble shows

#### Scenario: Peek due while speaking
- **WHEN** a user is picked for a peek while their speech bubble is visible
- **THEN** their peek is not shown, and the rotation moves to another eligible user or waits

### Requirement: Touch keeps a peek open
A peek SHALL be the same memo preview the note icon opens, with the same content, size and controls. The only difference is that a peek closes by itself. Any interaction with a peek (a tap, a scroll or a wheel) other than its close button SHALL keep it open until dismissed. A user whose preview is already open SHALL NOT be picked for a peek.

#### Scenario: Tap a peek
- **WHEN** the viewer taps a peek above a user
- **THEN** that user's memo preview stays open past the peek duration and closes only when the viewer taps outside it, taps its close button, or toggles the note icon

#### Scenario: Start scrolling a peek
- **WHEN** the viewer starts scrolling inside a peek
- **THEN** the preview stays open instead of fading out mid-read

#### Scenario: Peek looks like the opened preview
- **WHEN** a memo peeks and the same memo is later opened from the note icon
- **THEN** both show the same box, size, scrollable content and "see more →" link

#### Scenario: Preview already open
- **WHEN** a user's memo preview is open
- **THEN** no peek is shown for that user

### Requirement: Memo preview scrolls to the full memo
The memo preview, whether peeking or opened, SHALL show at most four lines of the memo at a time. It SHALL let the viewer read the rest by scrolling within it, including on touch devices, without panning the scene. It SHALL offer a "see more →" link that opens the Minds sheet.

#### Scenario: Long memo
- **WHEN** a memo is longer than four lines
- **THEN** the preview shows four lines, the viewer can scroll inside it to the end of the memo, and scrolling does not pan the scene

#### Scenario: Short memo
- **WHEN** a memo fits in four lines or fewer
- **THEN** the preview is only as tall as the memo, with no scrollbar

#### Scenario: Open Minds sheet
- **WHEN** the viewer taps "see more →" on a memo preview
- **THEN** the Minds sheet opens

### Requirement: Memo preview is translucent
The memo preview's background SHALL be translucent, so the scene behind it stays partly visible. It SHALL become opaque while the viewer is reading it: while the mouse is over it or it has keyboard focus, and on touch screens once it has been touched.

#### Scenario: Preview over a sprite
- **WHEN** a memo preview overlaps another sprite or scenery
- **THEN** that sprite or scenery can still be made out through the preview

#### Scenario: Hover to read
- **WHEN** the viewer moves the mouse over a memo preview
- **THEN** its background becomes opaque, and translucent again when the mouse leaves

#### Scenario: Touch to read
- **WHEN** on a touch screen the viewer touches a memo preview
- **THEN** its background is opaque for as long as it stays open

### Requirement: Memo preview has a close button
The memo preview SHALL have a close button. Closing a peek SHALL end it immediately without keeping it open. Closing an opened preview SHALL close it, the same as tapping outside it.

#### Scenario: Close a peek
- **WHEN** the viewer taps the close button on a peek
- **THEN** the peek disappears immediately and the rotation continues as normal

#### Scenario: Close an opened preview
- **WHEN** the viewer taps the close button on an opened preview
- **THEN** the preview closes

### Requirement: Per-viewer mute
The Minds sheet header SHALL have an on/off toggle, styled like the other sheets' on/off toggles, that turns peeks off for the viewer only. The setting SHALL be saved on the viewer's device across rooms and sessions and SHALL default to on. Muting SHALL NOT affect other users or stop the viewer from opening previews manually.

#### Scenario: Mute peeks
- **WHEN** the viewer turns the Minds toggle off
- **THEN** any visible peek disappears and no more peeks appear for that viewer

#### Scenario: Mute persists
- **WHEN** a viewer who muted peeks reloads or joins another room
- **THEN** peeks stay muted

#### Scenario: Others unaffected
- **WHEN** the viewer has muted peeks
- **THEN** other users still see the viewer's memo peek according to their own settings

### Requirement: Editor explains peeks
The memo editor SHALL tell the author that their note pops up above them now and then.

#### Scenario: Writing a memo
- **WHEN** a user opens the memo editor
- **THEN** a short hint explains that their note pops up above them now and then
