import type { Ambient, AmbientTime } from '../../types';

const TIME_TINTS: Record<AmbientTime, string> = {
  dawn: 'rgba(255,180,120,0.18)',
  day: 'rgba(255,255,200,0.04)',
  dusk: 'rgba(180,120,200,0.20)',
  night: 'rgba(20,20,60,0.42)',
};

export function AmbienceOverlay({ ambient }: { ambient: Ambient }) {
  const weatherStyle: React.CSSProperties = {
    opacity: Math.max(0, Math.min(1, (ambient.intensity ?? 70) / 100)),
  };
  return (
    <>
      <div className="ambient-overlay" style={{ background: TIME_TINTS[ambient.time] }} />
      {ambient.weather === 'rain' && <div className="ambient-rain" style={weatherStyle} />}
      {ambient.weather === 'snow' && <div className="ambient-snow" style={weatherStyle} />}
      {ambient.weather === 'fog' && <div className="ambient-fog" style={weatherStyle} />}
    </>
  );
}
