// Per-tab membership marker. Lets RoomEntry remember that this tab has
// already joined a room, so any redirect-out-and-back flow (Spotify auth,
// in-room invite, etc.) returns the user straight to the room instead of
// the "drop in" screen.
//
// sessionStorage scope is per-tab, so a fresh tab opened to /r/<id> won't
// inherit the marker — that user genuinely needs to drop in.

import { safeSessionGet, safeSessionRemove, safeSessionSet } from './storage';

const KEY = 'cya:active-room';

export function markRoomJoined(roomId: string) {
  safeSessionSet(KEY, roomId);
}

export function clearRoomJoined() {
  safeSessionRemove(KEY);
}

export function isCurrentRoom(roomId: string): boolean {
  return safeSessionGet(KEY) === roomId;
}
