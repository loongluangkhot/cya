import { Sheet } from './Sheet';
import Icon from '../Icon';
import { MusicGate } from './music/MusicGate';
import { MusicScreen } from './music/MusicScreen';
import type { MusicScreenProps } from './music/types';

interface MusicSheetProps extends MusicScreenProps {
  open: boolean;
  onClose: () => void;
  /** Whether the in-room video popup is currently visible. */
  roomVideoOn: boolean;
  onToggleRoomVideo: () => void;
}

export function MusicSheet(props: MusicSheetProps) {
  const {
    open,
    onClose,
    enabled,
    onEnable,
    onDisable,
    roomVideoOn,
    onToggleRoomVideo,
  } = props;
  const headerAction = (
    <>
      <button
        type="button"
        className={`sheet-toggle${enabled ? ' on' : ''}`}
        onClick={enabled ? onDisable : onEnable}
        aria-pressed={enabled}
        aria-label={enabled ? 'turn music off' : 'turn music on'}
      >
        {enabled ? 'on' : 'off'}
      </button>
      <button
        type="button"
        className={`sheet-icon-toggle${enabled && roomVideoOn ? ' on' : ''}`}
        onClick={onToggleRoomVideo}
        aria-pressed={roomVideoOn}
        aria-label={roomVideoOn ? 'hide in-room player' : 'show in-room player'}
        title={roomVideoOn ? 'hide in-room player' : 'show in-room player'}
        disabled={!enabled}
      >
        <Icon name="screen" size={12} />
      </button>
    </>
  );
  return (
    <Sheet open={open} onClose={onClose} title="music" tall headerAction={headerAction}>
      {enabled ? <MusicScreen {...props} /> : <MusicGate onEnable={onEnable} />}
    </Sheet>
  );
}
