import { getCharacterDef } from '../characters';
import type { CharacterId, ColorMap } from '../types';

interface PixelCharacterProps {
  character: CharacterId | string;
  color: string;
  scale?: number;
  crop?: 'full' | 'head';
}

export default function PixelCharacter({
  character,
  color,
  scale = 3,
  crop = 'full',
}: PixelCharacterProps) {
  const def = getCharacterDef(character);
  const cm: ColorMap = { ...def.colors, p: color };
  const yLimit = crop === 'head' ? 7 : def.grid.length - 1;

  let yMin = def.grid.length;
  let yMax = 0;
  let xMin = 12;
  let xMax = 0;
  const rects: JSX.Element[] = [];
  for (let y = 0; y <= yLimit; y++) {
    const row = def.grid[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const fill = cm[ch];
      if (!fill) continue;
      rects.push(
        <rect key={`${y}-${x}`} x={x} y={y} width={1} height={1} fill={fill} />,
      );
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
    }
  }
  if (yMin > yMax) {
    yMin = 0;
    yMax = def.grid.length - 1;
    xMin = 0;
    xMax = (def.grid[0]?.length ?? 12) - 1;
  }
  const w = xMax - xMin + 1;
  const h = yMax - yMin + 1;
  return (
    <svg
      className="pixel-svg"
      width={w * scale}
      height={h * scale}
      viewBox={`${xMin} ${yMin} ${w} ${h}`}
    >
      {rects}
    </svg>
  );
}
