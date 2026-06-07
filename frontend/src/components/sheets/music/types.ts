import type { PlaybackState } from '../../../types';

/** Everything the music screen + its sub-components need. The Sheet shell
    accepts these as-is, then passes them through to MusicScreen when the
    user has opted in (or to MusicGate otherwise). */
export interface MusicScreenProps {
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
  playback: PlaybackState;
  queue: string[];
  currentSec: number;
  durationSec: number;
  /** Local YT player volume 0..100. Per-listener — never broadcast. */
  volume: number;
  muted: boolean;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
  onTogglePlay: () => void;
  /** Jump the room's playhead. Click-to-seek on the progress bar feeds
      this; seeking to 0 is also how "restart" is expressed now. */
  onSeek: (positionMs: number) => void;
  onNext: () => void;
  onPlay: (videoId: string) => void;
  onAddToQueue: (videoId: string) => void;
  onPlayCollection: (videoIds: string[]) => void;
  onAddManyToQueue: (videoIds: string[]) => void;
  onRemoveFromQueue: (videoId: string, index: number) => void;
  onClearQueue: () => void;
  /** Move a queue entry from one index to another. Drives both
      drag-reorder and the per-row move-to-top button. */
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  /** Expand a pasted playlist URL into its video ids via the IFrame
      player (no API key). Returns [] if expansion fails. */
  onExpandPlaylist: (playlistId: string) => Promise<string[]>;
}
