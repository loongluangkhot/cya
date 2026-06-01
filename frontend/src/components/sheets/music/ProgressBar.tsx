function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ProgressBar({ cur, dur }: { cur: number; dur: number }) {
  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  return (
    <div className="yt-prog">
      <div className="yt-prog-track">
        <div className="yt-prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="yt-prog-times">
        <span>{fmtTime(cur)}</span>
        <span>youtube · {fmtTime(dur)}</span>
      </div>
    </div>
  );
}
