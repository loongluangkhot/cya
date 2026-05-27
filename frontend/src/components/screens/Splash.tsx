import Wordmark from '../Wordmark';

interface SplashProps {
  onStart: () => void;
}

export function SplashScreen({ onStart }: SplashProps) {
  return (
    <div className="screen">
      <div className="status-bar-space" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
        <Wordmark size={88} sub="a shared room for a while" />
        <p className="lede">
          Make a place. Share a link. Sit around the same music, the same light, the same nothing. Leave when you leave.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
        <button type="button" className="btn" onClick={onStart}>get started</button>
        <div className="h-mono" style={{ textAlign: 'center' }}>no account · no email · just a link</div>
      </div>
    </div>
  );
}
