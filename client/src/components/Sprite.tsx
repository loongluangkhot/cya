import { getCharacterDef } from '../characters';
import type { CharacterId, ColorMap } from '../types';

interface PixelGridProps {
  grid: readonly string[];
  colors: ColorMap;
}

function PixelGrid({ grid, colors }: PixelGridProps) {
  const out: JSX.Element[] = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const fill = colors[ch];
      if (!fill) continue;
      out.push(
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill} />,
      );
    }
  }
  return <>{out}</>;
}

interface SpriteProps {
  character: CharacterId;
  direction?: 'left' | 'right';
}

export default function Sprite({ character }: SpriteProps) {
  const def = getCharacterDef(character);
  if (!def) return <div className="sprite" />;
  return (
    <div className="sprite pixel">
      <div className="sprite-shadow" />
      <svg
        className="pixel-svg"
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        preserveAspectRatio="xMidYMid meet"
      >
        <PixelGrid grid={def.grid} colors={def.colors || {}} />
      </svg>
    </div>
  );
}
