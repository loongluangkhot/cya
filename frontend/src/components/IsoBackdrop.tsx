import { type ReactNode } from 'react';

export const ISO_TILE_W = 84;
export const ISO_TILE_H = 44;
export const ISO_GRID = 10;
export const ISO_WALL_H = 200;

export interface IsoPt {
  x: number;
  y: number;
}

export function iso(wx: number, wy: number): IsoPt {
  return {
    x: (wx - wy) * (ISO_TILE_W / 2),
    y: (wx + wy) * (ISO_TILE_H / 2),
  };
}

export function isoFromPct(px: number, py: number): IsoPt {
  return iso(px / 10, py / 10);
}

function isoDiamondPts(x: number, y: number, sx: number, sy: number): string {
  const A = iso(x, y);
  const B = iso(x + sx, y);
  const C = iso(x + sx, y + sy);
  const D = iso(x, y + sy);
  return `${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`;
}

interface IsoBoxProps {
  x: number;
  y: number;
  sx: number;
  sy: number;
  h: number;
  top: string;
  right: string;
  left: string;
  stroke?: string;
  sw?: number;
}

function IsoBox({ x, y, sx, sy, h, top, right, left, stroke = 'var(--scene-line)', sw = 1 }: IsoBoxProps) {
  const A = iso(x, y);
  const B = iso(x + sx, y);
  const C = iso(x + sx, y + sy);
  const D = iso(x, y + sy);
  const At = { x: A.x, y: A.y - h };
  const Bt = { x: B.x, y: B.y - h };
  const Ct = { x: C.x, y: C.y - h };
  const Dt = { x: D.x, y: D.y - h };
  const pts = (...ps: IsoPt[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <g>
      <polygon points={pts(B, C, Ct, Bt)} fill={right} stroke={stroke} strokeWidth={sw} strokeLinejoin="miter" />
      <polygon points={pts(D, C, Ct, Dt)} fill={left} stroke={stroke} strokeWidth={sw} strokeLinejoin="miter" />
      <polygon points={pts(At, Bt, Ct, Dt)} fill={top} stroke={stroke} strokeWidth={sw} strokeLinejoin="miter" />
    </g>
  );
}

// Deterministic pseudo-random for stable per-tile decoration.
function tileHash(x: number, y: number): number {
  const n = Math.sin(x * 374761.39 + y * 668265.26) * 43758.5453;
  return n - Math.floor(n);
}

type TileType = 'grass' | 'dirt' | 'stone' | 'water' | 'sand';

interface TileProps {
  x: number;
  y: number;
  type: TileType;
  stroke?: string;
}

function Tile({ x, y, type, stroke = 'rgba(0,0,0,0.18)' }: TileProps) {
  const seed = tileHash(x, y);
  let fill: string;
  let decor: ReactNode = null;
  if (type === 'grass') {
    fill = seed > 0.5 ? '#7faa55' : '#88b860';
    if (seed > 0.78) {
      const c = iso(x + 0.5, y + 0.5);
      decor = (
        <g>
          <line x1={c.x - 3} y1={c.y - 1} x2={c.x - 4} y2={c.y - 5} stroke="#496e2c" strokeWidth="1.2" />
          <line x1={c.x} y1={c.y - 1} x2={c.x} y2={c.y - 6} stroke="#496e2c" strokeWidth="1.2" />
          <line x1={c.x + 3} y1={c.y - 1} x2={c.x + 4} y2={c.y - 5} stroke="#496e2c" strokeWidth="1.2" />
        </g>
      );
    } else if (seed > 0.68) {
      const c = iso(x + 0.5, y + 0.5);
      decor = <circle cx={c.x} cy={c.y - 2} r={1.6} fill={seed > 0.73 ? '#f1d24a' : '#e87d7d'} />;
    }
  } else if (type === 'dirt') {
    fill = seed > 0.6 ? '#a87a4a' : '#9c6f42';
  } else if (type === 'stone') {
    fill = seed > 0.55 ? '#a8a8a8' : '#9a9a9a';
    if (seed > 0.85) {
      const c = iso(x + 0.5, y + 0.5);
      decor = <line x1={c.x - 4} y1={c.y - 2} x2={c.x + 2} y2={c.y + 1} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />;
    }
  } else if (type === 'water') {
    fill = '#5a9fc4';
  } else {
    fill = seed > 0.55 ? '#e9d9a8' : '#dfcc94';
  }
  return (
    <g>
      <polygon points={isoDiamondPts(x, y, 1, 1)} fill={fill} stroke={stroke} strokeWidth="0.6" />
      {decor}
    </g>
  );
}

function TiledFloor({ tileAt }: { tileAt: (x: number, y: number) => TileType }) {
  const tiles: ReactNode[] = [];
  for (let y = 0; y < ISO_GRID; y++) {
    for (let x = 0; x < ISO_GRID; x++) {
      tiles.push(<Tile key={`${x},${y}`} x={x} y={y} type={tileAt(x, y)} />);
    }
  }
  return <g>{tiles}</g>;
}

function IsoTree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  const base = iso(x, y);
  const s = size;
  const top = { x: base.x, y: base.y - 18 * s };
  const r = 24 * s;
  const rh = 14 * s;
  const a = { x: top.x - r, y: top.y };
  const b = { x: top.x, y: top.y - rh };
  const c = { x: top.x + r, y: top.y };
  const d = { x: top.x, y: top.y + rh };
  const a2 = { x: top.x - r * 0.8, y: top.y - rh * 0.9 };
  const b2 = { x: top.x, y: top.y - rh * 1.9 };
  const c2 = { x: top.x + r * 0.8, y: top.y - rh * 0.9 };
  const d2 = { x: top.x, y: top.y + rh * 0.1 };
  return (
    <g>
      <IsoBox
        x={x - 0.18}
        y={y - 0.18}
        sx={0.36}
        sy={0.36}
        h={18 * s}
        top="#6b4423"
        right="#5a371c"
        left="#3f2614"
        sw={0.8}
      />
      <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`} fill="#3d6f2a" stroke="#23421a" strokeWidth="1" />
      <polygon points={`${a2.x},${a2.y} ${b2.x},${b2.y} ${c2.x},${c2.y} ${d2.x},${d2.y}`} fill="#4f8a36" stroke="#23421a" strokeWidth="1" />
    </g>
  );
}

function IsoRock({ x, y, big = false }: { x: number; y: number; big?: boolean }) {
  const sx = big ? 0.7 : 0.45;
  const h = big ? 16 : 10;
  return (
    <IsoBox
      x={x - sx / 2}
      y={y - sx / 2}
      sx={sx}
      sy={sx}
      h={h}
      top="#b8b0a4"
      right="#9a9388"
      left="#74706a"
      sw={0.8}
    />
  );
}

function IsoBush({ x, y }: { x: number; y: number }) {
  const base = iso(x, y);
  return (
    <g>
      <ellipse cx={base.x - 5} cy={base.y - 4} rx={7} ry={5} fill="#3d6f2a" stroke="#23421a" strokeWidth="0.8" />
      <ellipse cx={base.x + 5} cy={base.y - 6} rx={7} ry={5} fill="#4f8a36" stroke="#23421a" strokeWidth="0.8" />
      <ellipse cx={base.x} cy={base.y - 8} rx={6} ry={5} fill="#5fa343" stroke="#23421a" strokeWidth="0.8" />
    </g>
  );
}

function IsoCampfire({ x, y }: { x: number; y: number }) {
  const base = iso(x, y);
  return (
    <g>
      <circle cx={base.x - 6} cy={base.y - 1} r={3.2} fill="#8a8278" stroke="#5c564f" strokeWidth="0.6" />
      <circle cx={base.x + 6} cy={base.y - 1} r={3.2} fill="#8a8278" stroke="#5c564f" strokeWidth="0.6" />
      <circle cx={base.x} cy={base.y + 3} r={3.2} fill="#8a8278" stroke="#5c564f" strokeWidth="0.6" />
      <circle cx={base.x} cy={base.y - 4} r={3.2} fill="#8a8278" stroke="#5c564f" strokeWidth="0.6" />
      <line x1={base.x - 5} y1={base.y - 1} x2={base.x + 5} y2={base.y - 1} stroke="#4d2f17" strokeWidth="2" strokeLinecap="round" />
      <line x1={base.x - 4} y1={base.y + 1} x2={base.x + 4} y2={base.y - 3} stroke="#3a2310" strokeWidth="2" strokeLinecap="round" />
      <polygon points={`${base.x - 4},${base.y - 2} ${base.x},${base.y - 16} ${base.x + 4},${base.y - 2}`} fill="#ff8b3d" stroke="#c25218" strokeWidth="0.8" />
      <polygon points={`${base.x - 2.5},${base.y - 4} ${base.x},${base.y - 12} ${base.x + 2.5},${base.y - 4}`} fill="#ffd255" />
      <circle cx={base.x} cy={base.y - 8} r={36} fill="rgba(255, 160, 80, 0.18)" />
    </g>
  );
}

function IsoSignpost({ x, y, text }: { x: number; y: number; text: string }) {
  const base = iso(x, y);
  return (
    <g>
      <line x1={base.x} y1={base.y} x2={base.x} y2={base.y - 36} stroke="#3a2310" strokeWidth="3" strokeLinecap="round" />
      <rect x={base.x - 14} y={base.y - 36} width={28} height={14} fill="#a87a4a" stroke="#3a2310" strokeWidth="1.2" />
      <text x={base.x} y={base.y - 26} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fontWeight="700" fill="#3a2310">
        {text}
      </text>
    </g>
  );
}

function IsoFlower({ x, y, color }: { x: number; y: number; color: string }) {
  const base = iso(x, y);
  return (
    <g>
      <line x1={base.x} y1={base.y - 2} x2={base.x} y2={base.y - 8} stroke="#3d6f2a" strokeWidth="0.9" />
      <circle cx={base.x} cy={base.y - 9} r={2} fill={color} stroke="#7a5a1a" strokeWidth="0.5" />
    </g>
  );
}

function IsoLamp({ x, y }: { x: number; y: number }) {
  const base = iso(x, y);
  return (
    <g>
      <IsoBox x={x - 0.12} y={y - 0.12} sx={0.24} sy={0.24} h={38} top="#2a2a2a" right="#1c1c1c" left="#101010" sw={0.8} />
      <circle cx={base.x} cy={base.y - 42} r={5} fill="#ffe28b" stroke="#3a2310" strokeWidth="0.8" />
      <circle cx={base.x} cy={base.y - 42} r={14} fill="rgba(255, 220, 140, 0.22)" />
    </g>
  );
}

function ClearingBackdrop() {
  const M = [
    'gggggggggg',
    'gggdddgggg',
    'gggdgdgggg',
    'ggdddggggg',
    'gddggggggg',
    'gdgggsssgg',
    'gdggssssgg',
    'ggggsssggg',
    'gggggwwggg',
    'ggggwwwwgg',
  ];
  const typeFor = (x: number, y: number): TileType => {
    const ch = M[y][x];
    return ch === 'd' ? 'dirt' : ch === 's' ? 'stone' : ch === 'w' ? 'water' : 'grass';
  };
  return (
    <g>
      <TiledFloor tileAt={typeFor} />
      <IsoTree x={1.5} y={0.7} />
      <IsoTree x={3.5} y={0.5} size={0.85} />
      <IsoTree x={8.2} y={0.6} />
      <IsoTree x={9.0} y={2.5} size={0.9} />
      <IsoTree x={0.8} y={6.0} size={0.95} />
      <IsoTree x={9.2} y={5.5} size={0.85} />
      <IsoCampfire x={6.5} y={6.5} />
      <IsoRock x={2.5} y={7.5} big />
      <IsoRock x={3.2} y={8.2} />
      <IsoBush x={6.5} y={2.5} />
      <IsoBush x={8.5} y={7.5} />
      <IsoFlower x={2.2} y={4.5} color="#f1d24a" />
      <IsoFlower x={2.7} y={4.7} color="#e87d7d" />
      <IsoFlower x={4.5} y={2.2} color="#c478e0" />
      <IsoSignpost x={4.5} y={0.4} text="HI" />
    </g>
  );
}

function PlazaBackdrop() {
  const typeFor = (x: number, y: number): TileType => {
    if (x === 0 || y === 0 || x === ISO_GRID - 1 || y === ISO_GRID - 1) return 'grass';
    if (x === 1 || y === 1 || x === ISO_GRID - 2 || y === ISO_GRID - 2) return 'dirt';
    return 'stone';
  };
  const cx = 4.5;
  const cy = 4.5;
  const c = iso(cx + 0.5, cy + 0.5);
  return (
    <g>
      <TiledFloor tileAt={typeFor} />
      <polygon points={isoDiamondPts(3.5, 3.5, 3, 3)} fill="#8a8278" stroke="#3a3530" strokeWidth="1.2" />
      <polygon points={isoDiamondPts(3.8, 3.8, 2.4, 2.4)} fill="#5a9fc4" stroke="#3a3530" strokeWidth="1" />
      <IsoBox x={cx - 0.05} y={cy - 0.05} sx={0.5} sy={0.5} h={24} top="#b8b0a4" right="#9a9388" left="#74706a" sw={1} />
      <circle cx={c.x - 4} cy={c.y - 32} r={1.5} fill="#a8d4e8" />
      <circle cx={c.x + 4} cy={c.y - 30} r={1.5} fill="#a8d4e8" />
      <circle cx={c.x} cy={c.y - 34} r={1.5} fill="#a8d4e8" />
      <IsoLamp x={2.5} y={2.5} />
      <IsoLamp x={7.0} y={2.5} />
      <IsoLamp x={2.5} y={7.0} />
      <IsoLamp x={7.0} y={7.0} />
      <IsoBox x={4.0} y={1.5} sx={1.5} sy={0.35} h={10} top="#6b4423" right="#5a371c" left="#3f2614" sw={1} />
      <IsoBox x={4.0} y={7.8} sx={1.5} sy={0.35} h={10} top="#6b4423" right="#5a371c" left="#3f2614" sw={1} />
      <IsoTree x={0.5} y={0.5} size={0.9} />
      <IsoTree x={9.2} y={0.5} size={0.9} />
      <IsoTree x={0.5} y={9.0} size={0.9} />
    </g>
  );
}

export function IsoBackdrop({ room }: { room: string }) {
  if (room === 'plaza') return <PlazaBackdrop />;
  return <ClearingBackdrop />;
}
