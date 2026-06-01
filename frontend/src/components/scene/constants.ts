// Walk-animation timing. The local user gets a snappy 220ms transition
// (immediate feedback); peers ease in over ~1.1s so their interpolated
// position stays roughly in sync with what the server reports.

export const WALK_MS_ME = 220;
export const WALK_MS_OTHER = 1100;
