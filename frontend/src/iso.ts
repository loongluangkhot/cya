// Iso-projection constants and helpers. Lives outside IsoBackdrop so the
// scene component can import the geometry without pulling in the SVG tree.

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
