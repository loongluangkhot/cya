import { Sheet } from './Sheet';
import { MusicGate } from './music/MusicGate';
import { MusicScreen } from './music/MusicScreen';
import type { MusicScreenProps, PlayerMode } from './music/types';

export type { PlayerMode };

interface MusicSheetProps extends MusicScreenProps {
  open: boolean;
  onClose: () => void;
}

export function MusicSheet(props: MusicSheetProps) {
  const { open, onClose, enabled, onEnable } = props;
  return (
    <Sheet open={open} onClose={onClose} title="music" tall>
      {enabled ? <MusicScreen {...props} /> : <MusicGate onEnable={onEnable} />}
    </Sheet>
  );
}
