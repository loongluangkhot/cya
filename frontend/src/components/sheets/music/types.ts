import type { RefObject } from 'react';
import type { PlaybackState } from '../../../types';

export type PlayerMode = 'theater' | 'audio';

/** Everything the music screen + its sub-components need. The Sheet shell
    accepts these as-is, then passes them through to MusicScreen when the
    user has opted in (or to MusicGate otherwise). */
export interface MusicScreenProps {
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
  playback: PlaybackState;
  queue: string[];
  /** Mount target for the YouTube IFrame in theater mode. Room owns the
      ref because the player has to survive when the sheet closes. */
  stageRef: RefObject<HTMLDivElement>;
  playerMode: PlayerMode;
  onChangePlayerMode: (mode: PlayerMode) => void;
  currentSec: number;
  durationSec: number;
  onTogglePlay: () => void;
  onRestart: () => void;
  onNext: () => void;
  onPlay: (videoId: string) => void;
  onAddToQueue: (videoId: string) => void;
  onPlayCollection: (videoIds: string[]) => void;
  onAddManyToQueue: (videoIds: string[]) => void;
  onRemoveFromQueue: (videoId: string, index: number) => void;
  onClearQueue: () => void;
  /** Expand a pasted playlist URL into its video ids via the IFrame
      player (no API key). Returns [] if expansion fails. */
  onExpandPlaylist: (playlistId: string) => Promise<string[]>;
}
