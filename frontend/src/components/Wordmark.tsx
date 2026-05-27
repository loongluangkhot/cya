interface WordmarkProps {
  size?: number;
  sub?: string;
}

export default function Wordmark({ size = 56, sub }: WordmarkProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div className="wordmark" style={{ fontSize: size }}>cya</div>
      {sub && <div className="wordmark-sub">{sub}</div>}
    </div>
  );
}
