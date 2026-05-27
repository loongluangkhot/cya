// Per-tab membership marker. Lets RoomEntry remember that this tab has
// already joined a room, so any redirect-out-and-back flow (Spotify auth,
// in-room invite, etc.) returns the user straight to the room instead of
// the "drop in" screen.
//
// sessionStorage scope is per-tab, so a fresh tab opened to /r/<id> won't
// inherit the marker — that user genuinely needs to drop in.

const KEY = 'cya:active-room';

export function markRoomJoined(roomId: string) {
  try {
    sessionStorage.setItem(KEY, roomId);
  } catch {
    // ignore
  }
}

export function clearRoomJoined() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function isCurrentRoom(roomId: string): boolean {
  try {
    return sessionStorage.getItem(KEY) === roomId;
  } catch {
    return false;
  }
}
