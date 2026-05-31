import { useState } from 'react';
import IsoScene from './IsoScene';
import { AmbienceOverlay } from './room/AmbienceOverlay';
import { DPad } from './room/DPad';
import { IrcLog } from './room/IrcLog';
import { RoomDock, computeDockPlaybackLabel } from './room/RoomDock';
import { RoomTopBar } from './room/RoomTopBar';
import { Toasts } from './room/Toasts';
import { AmbienceSheet } from './sheets/AmbienceSheet';
import { ChatLogSheet } from './sheets/ChatLogSheet';
import { MemoEditorSheet } from './sheets/MemoEditorSheet';
import { MindsSheet } from './sheets/MindsSheet';
import { MusicSheet } from './sheets/MusicSheet';
import { PeopleSheet } from './sheets/PeopleSheet';
import { effectivePosition } from './spotify/shared';
import { useMovement } from '../hooks/useMovement';
import { useRoomState } from '../hooks/useRoomState';
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';
import { useToasts } from '../hooks/useToasts';
import type { User } from '../types';

interface RoomProps {
  roomId: string;
  onEditMe: () => void;
  onLeave: () => void;
  /** Persist a memo change back to the user's localStorage identity, so
      it travels into the next room they join. */
  onMemoPersist: (memo: string) => void;
}

type SheetId = 'people' | 'chat' | 'music' | 'ambience' | 'minds' | 'memo-editor' | null;

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

  // Spotify SDK lives at Room scope so the dock chip can reflect *this
  // user's* actual audio state — not just whatever the room thinks is
  // playing. When you first enter a room with Spotify already connected,
  // the SDK takes a beat to load and transfer playback; during that gap
  // the chip should say "starting…" rather than misleadingly say "playing".
  const player = useSpotifyPlayer({
    playback,
    queue,
    onLocalChange: changePlayback,
    onAddToQueue: addToQueue,
    onAddManyToQueue: addManyToQueue,
    onPlayCollection: playCollection,
    onAdvanceQueue: advanceQueue,
  });

  const [sheet, setSheet] = useState<SheetId>(null);
  const [draft, setDraft] = useState('');

  function onSend(text: string) {
    if (!text.trim()) return;
    sendMessage(text);
    setDraft('');
  }

  function changeMemo(memo: string) {
    updateMemo(memo);
    onMemoPersist(memo);
  }

  // Dock chip playback controls — operate on the shared room playback
  // state, not the local SDK. Whoever's connected applies them.
  function dockPrev() {
    if (!playback.trackUri) return;
    changePlayback({
      trackUri: playback.trackUri,
      isPlaying: true,
      positionMs: 0,
    });
  }
  function dockTogglePlay() {
    if (!playback.trackUri) return;
    changePlayback({
      trackUri: playback.trackUri,
      isPlaying: !playback.isPlaying,
      positionMs: effectivePosition(playback),
    });
  }
  function dockNext() {
    advanceQueue(playback.trackUri);
  }

  const peersById: Record<string, User> = Object.fromEntries(users.map((u) => [u.id, u]));
  const dockPlaybackLabel = computeDockPlaybackLabel(playback, player);

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

      <DPad
        onNudge={(dx, dy) => {
          // Any manual D-pad input cancels wander.
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
        onLeave={onLeave}
      />

      <IrcLog messages={messages.slice(-4)} peersById={peersById} roomId={roomId} />

      <RoomDock
        ambient={ambient}
        spotifyConnected={player.connected}
        roomId={roomId}
        onSendVoice={sendVoice}
        playback={playback}
        playbackLabel={dockPlaybackLabel}
        trackArt={
          player.connected && playback.trackUri
            ? trackMeta[playback.trackUri]?.art
            : undefined
        }
        trackTitle={
          player.connected && playback.trackUri
            ? trackMeta[playback.trackUri]?.title
            : undefined
        }
        draft={draft}
        setDraft={setDraft}
        onSend={onSend}
        onOpenMusic={() => setSheet('music')}
        onOpenAmbience={() => setSheet('ambience')}
        onOpenMinds={() => setSheet('minds')}
        onOpenChat={() => setSheet('chat')}
        hasQueue={queue.length > 0}
        onPrev={dockPrev}
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
        player={player}
        playback={playback}
        queue={queue}
        onRemoveFromQueue={removeFromQueue}
        onClearQueue={clearQueue}
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
    </div>
  );
}
