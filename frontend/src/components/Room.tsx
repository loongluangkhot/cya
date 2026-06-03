import { useEffect, useRef, useState } from 'react';
import IsoScene from './IsoScene';
import { AmbienceOverlay } from './room/AmbienceOverlay';
import { DPad } from './room/DPad';
import { IrcLog } from './room/IrcLog';
import { RoomDock } from './room/RoomDock';
import { RoomTopBar } from './room/RoomTopBar';
import { RoomVideo, type RoomPlacement } from './room/RoomVideo';
import { Toasts } from './room/Toasts';
import { AmbienceSheet } from './sheets/AmbienceSheet';
import { ChatLogSheet } from './sheets/ChatLogSheet';
import { MemoEditorSheet } from './sheets/MemoEditorSheet';
import { MindsSheet } from './sheets/MindsSheet';
import { MusicSheet, type PlayerMode } from './sheets/MusicSheet';
import { PeopleSheet } from './sheets/PeopleSheet';
import { SettingsSheet } from './sheets/SettingsSheet';
import { useMessageNotifications } from '../hooks/useMessageNotifications';
import { useMovement } from '../hooks/useMovement';
import { useRoomState } from '../hooks/useRoomState';
import { useStoredState } from '../hooks/useStoredState';
import { useToasts } from '../hooks/useToasts';
import { useYoutubePlayer } from '../hooks/useYoutubePlayer';
import { applyTheme, loadTheme, saveTheme, type ThemeId } from '../themes';
import type { User } from '../types';

interface RoomProps {
  roomId: string;
  onEditMe: () => void;
  onLeave: () => void;
  onMemoPersist: (memo: string) => void;
}

type SheetId =
  | 'people'
  | 'chat'
  | 'music'
  | 'ambience'
  | 'minds'
  | 'memo-editor'
  | 'settings'
  | null;

const PLAYER_MODE_KEY = 'cya:yt:mode:v1';
const ROOM_PLACEMENT_KEY = 'cya:yt:room:v1';

function validatePlayerMode(v: unknown): PlayerMode | null {
  return v === 'theater' || v === 'audio' ? v : null;
}
function validateRoomPlacement(v: unknown): RoomPlacement | null {
  return v === 'corner' || v === 'wall' || v === 'off' ? v : null;
}

export default function Room({ roomId, onEditMe, onLeave, onMemoPersist }: RoomProps) {
  const { toasts, pushToast } = useToasts();
  const {
    meId,
    users,
    setUsers,
    messages,
    bubbles,
    ambient,
    playback,
    queue,
    trackMeta,
    sendMessage,
    sendVoice,
    updateMemo,
    changeAmbient,
    changePlayback,
    addToQueue,
    addManyToQueue,
    playCollection,
    removeFromQueue,
    advanceQueue,
    clearQueue,
  } = useRoomState({ onToast: pushToast });
  const { nudge, wandering, setWandering } = useMovement({ meId, users, setUsers });

  const [playerMode, setPlayerMode] = useStoredState<PlayerMode>(PLAYER_MODE_KEY, 'audio', validatePlayerMode);
  const [roomPlacement, setRoomPlacement] = useStoredState<RoomPlacement>(
    ROOM_PLACEMENT_KEY,
    'corner',
    validateRoomPlacement,
  );

  const ytPlayer = useYoutubePlayer({
    playback,
    onEnded: () => advanceQueue(playback.trackUri),
  });

  const [sheet, setSheet] = useState<SheetId>(null);
  const [draft, setDraft] = useState('');
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const { state: notifState, toggle: toggleNotif } = useMessageNotifications({
    messages,
    meId,
    roomId,
  });

  // Player stays mounted across sheet open/close — we move it between
  // surfaces (music sheet stage, in-room video, hidden audio host).
  const sheetStageRef = useRef<HTMLDivElement | null>(null);
  const roomStageRef = useRef<HTMLDivElement | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);

  // Remember the last non-off placement so the dock toggle can restore it.
  const lastVisiblePlacementRef = useRef<RoomPlacement>('corner');
  useEffect(() => {
    if (roomPlacement !== 'off') lastVisiblePlacementRef.current = roomPlacement;
  }, [roomPlacement]);

  // Decide which surface the player mounts into. Priority:
  // audio-only → hidden host; music sheet open → sheet; else if room
  // placement is on → room video; else → hidden host (audio keeps going).
  // startAt extrapolates the room's last reported position by the time
  // elapsed since that report, so a new joiner drops in mid-track.
  useEffect(() => {
    if (!ytPlayer.enabled || !playback.trackUri) {
      ytPlayer.attach(null, null);
      return;
    }
    let container: HTMLElement | null;
    if (playerMode === 'audio') container = audioHostRef.current;
    else if (sheet === 'music') container = sheetStageRef.current;
    else if (roomPlacement !== 'off') container = roomStageRef.current;
    else container = audioHostRef.current;
    if (!container) return;
    const elapsedMs = playback.isPlaying
      ? Date.now() - playback.positionUpdatedAt
      : 0;
    const startAt = (playback.positionMs + elapsedMs) / 1000;
    ytPlayer.attach(container, {
      videoId: playback.trackUri,
      startAt,
      playing: playback.isPlaying,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytPlayer.enabled, playback.trackUri, playerMode, sheet, roomPlacement]);

  function onSend(text: string) {
    if (!text.trim()) return;
    sendMessage(text);
    setDraft('');
  }

  function changeMemo(memo: string) {
    updateMemo(memo);
    onMemoPersist(memo);
  }

  // Shared playback controls — these flip room state, which every
  // connected client (including this one) reacts to via the sync effect
  // inside useYoutubePlayer.
  function dockRestart() {
    if (!playback.trackUri) return;
    changePlayback({ trackUri: playback.trackUri, isPlaying: true, positionMs: 0 });
  }
  function dockTogglePlay() {
    if (!playback.trackUri) return;
    changePlayback({
      trackUri: playback.trackUri,
      isPlaying: !playback.isPlaying,
      positionMs: ytPlayer.getPositionMs(),
    });
  }
  function dockNext() {
    advanceQueue(playback.trackUri);
  }
  function playTrack(videoId: string) {
    changePlayback({ trackUri: videoId, isPlaying: true, positionMs: 0 });
  }

  function toggleRoomVideo() {
    if (roomPlacement === 'off') setRoomPlacement(lastVisiblePlacementRef.current);
    else setRoomPlacement('off');
  }

  // Local opt-out — unsubscribe from the room's shared music. The room's
  // playback and queue keep going for everyone else; re-enabling here just
  // resumes at whatever the shared state is now.
  function turnOffMusic() {
    ytPlayer.disable();
  }

  function expandPlaylist(playlistId: string): Promise<string[]> {
    return ytPlayer.expandPlaylist(playlistId);
  }

  const peersById: Record<string, User> = Object.fromEntries(users.map((u) => [u.id, u]));
  const dockMeta = !ytPlayer.enabled
    ? 'off'
    : !playback.trackUri
      ? 'tap to set a track'
      : playback.isPlaying
        ? 'playing'
        : 'paused';

  const showRoomVideo =
    ytPlayer.enabled &&
    !!playback.trackUri &&
    sheet !== 'music' &&
    roomPlacement !== 'off';

  return (
    <div className="room-root">
      <IsoScene
        peers={users}
        meId={meId}
        bubbles={bubbles}
        room={ambient.room}
        onOpenMemo={() => setSheet('minds')}
        onWriteMemo={() => setSheet('memo-editor')}
      />
      <AmbienceOverlay ambient={ambient} />

      {/* Hidden host keeps audio alive when no visible surface is mounted. */}
      <div ref={audioHostRef} className="yt-audio-host" aria-hidden="true" />

      {showRoomVideo && playback.trackUri && (
        <RoomVideo
          trackId={playback.trackUri}
          placement={roomPlacement === 'wall' ? 'wall' : 'corner'}
          audioOnly={playerMode === 'audio'}
          isPlaying={playback.isPlaying}
          hasQueue={queue.length > 0}
          stageRef={roomStageRef}
          onOpen={() => setSheet('music')}
          onTogglePlay={dockTogglePlay}
          onNext={dockNext}
          onClose={() => setRoomPlacement('off')}
        />
      )}

      <DPad
        onNudge={(dx, dy) => {
          setWandering(false);
          nudge(dx, dy);
        }}
      />
      <button
        type="button"
        className={`wander-btn${wandering ? ' active' : ''}`}
        onClick={() => setWandering((w) => !w)}
        aria-pressed={wandering}
      >
        wander
      </button>

      <RoomTopBar
        roomId={roomId}
        peers={users}
        onOpenPeople={() => setSheet('people')}
        onOpenSettings={() => setSheet('settings')}
        onLeave={onLeave}
      />

      <IrcLog messages={messages.slice(-4)} peersById={peersById} roomId={roomId} />

      <RoomDock
        ambient={ambient}
        roomId={roomId}
        onSendVoice={sendVoice}
        playback={playback}
        playbackMeta={dockMeta}
        musicEnabled={ytPlayer.enabled}
        trackArt={playback.trackUri ? trackMeta[playback.trackUri]?.art : undefined}
        trackTitle={playback.trackUri ? trackMeta[playback.trackUri]?.title : undefined}
        audioOnly={playerMode === 'audio'}
        roomVideoOn={roomPlacement !== 'off'}
        onToggleRoomVideo={toggleRoomVideo}
        draft={draft}
        setDraft={setDraft}
        onSend={onSend}
        onOpenMusic={() => setSheet('music')}
        onOpenAmbience={() => setSheet('ambience')}
        onOpenMinds={() => setSheet('minds')}
        onOpenChat={() => setSheet('chat')}
        hasQueue={queue.length > 0}
        onPrev={dockRestart}
        onTogglePlay={dockTogglePlay}
        onNext={dockNext}
      />

      <Toasts items={toasts} />

      <PeopleSheet
        open={sheet === 'people'}
        onClose={() => setSheet(null)}
        peers={users}
        meId={meId}
        onEditMe={onEditMe}
      />
      <ChatLogSheet
        open={sheet === 'chat'}
        onClose={() => setSheet(null)}
        messages={messages}
        peersById={peersById}
        roomId={roomId}
      />
      <MusicSheet
        open={sheet === 'music'}
        onClose={() => setSheet(null)}
        enabled={ytPlayer.enabled}
        onEnable={ytPlayer.enable}
        onDisable={turnOffMusic}
        playback={playback}
        queue={queue}
        stageRef={sheetStageRef}
        playerMode={playerMode}
        onChangePlayerMode={setPlayerMode}
        currentSec={ytPlayer.currentSec}
        durationSec={ytPlayer.durationSec}
        onTogglePlay={dockTogglePlay}
        onRestart={dockRestart}
        onNext={dockNext}
        onPlay={playTrack}
        onAddToQueue={addToQueue}
        onPlayCollection={playCollection}
        onAddManyToQueue={addManyToQueue}
        onRemoveFromQueue={removeFromQueue}
        onClearQueue={clearQueue}
        onExpandPlaylist={expandPlaylist}
      />
      <AmbienceSheet
        open={sheet === 'ambience'}
        onClose={() => setSheet(null)}
        ambient={ambient}
        onChange={changeAmbient}
      />
      <MindsSheet
        open={sheet === 'minds'}
        onClose={() => setSheet(null)}
        peers={users}
        meId={meId}
        onEditMine={() => setSheet('memo-editor')}
      />
      <MemoEditorSheet
        open={sheet === 'memo-editor'}
        initial={users.find((u) => u.id === meId)?.memo ?? ''}
        onCancel={() => setSheet(null)}
        onSave={(memo) => {
          changeMemo(memo);
          setSheet('minds');
        }}
      />
      <SettingsSheet
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
        theme={theme}
        onChangeTheme={(next) => {
          setTheme(next);
          applyTheme(next);
          saveTheme(next);
        }}
        notifState={notifState}
        onToggleNotif={toggleNotif}
      />
    </div>
  );
}
