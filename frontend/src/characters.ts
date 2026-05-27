import type { CharacterDef, CharacterId, ColorDef, ColorId, ColorMap } from './types';

export const PIXEL_W = 12;
export const PIXEL_H = 15;

const BASE: ColorMap = {
  f: '#f0c7a4',
  a: '#f0c7a4',
  e: '#1a1a1a',
  l: '#262626',
  b: '#0a0a0a',
  w: '#ffffff',
  k: '#000000',
};

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  chef: {
    id: 'chef',
    label: 'chef',
    description: 'kitchen, dish in hand',
    grid: [
      '....hhhh....',
      '...hhhhhh...',
      '..hhhhhhhh..',
      '..hhhhhhhh..',
      '...iiiiii...',
      '...ffffff...',
      '...fefeef...',
      '....ffff....',
      '...appppa...',
      '...awppwa...',
      '...awppwa...',
      '...appppa...',
      '...ll..ll...',
      '...ll..ll...',
      '...bb..bb...',
    ],
    colors: { ...BASE, h: '#ffffff', i: '#d6442f' },
  },
  astronaut: {
    id: 'astronaut',
    label: 'astronaut',
    description: 'space suit, helmet',
    grid: [
      '...hhhhhh...',
      '..hhhhhhhh..',
      '..hggggggh..',
      '..hgggwggh..',
      '..hggggggh..',
      '..hgggggggh.',
      '...hhhhhh...',
      '....ffff....',
      '...appppa...',
      '...appwpa...',
      '...appppa...',
      '...appppa...',
      '...ll..ll...',
      '...ll..ll...',
      '...bb..bb...',
    ],
    colors: { ...BASE, h: '#e9e9e9', g: '#1e3a5f' },
  },
  detective: {
    id: 'detective',
    label: 'detective',
    description: 'fedora, raincoat',
    grid: [
      '............',
      '....hhhh....',
      '...hhhhhh...',
      '.hhhhhhhhhh.',
      '...iiiiii...',
      '...ffffff...',
      '...fefeef...',
      '....ffff....',
      '...appppa...',
      '...gppppga..',
      '...gppppg...',
      '...gppppg...',
      '...ll..ll...',
      '...ll..ll...',
      '...bb..bb...',
    ],
    colors: { ...BASE, h: '#5a3920', i: '#1a1a1a', g: '#3d2614' },
  },
  wizard: {
    id: 'wizard',
    label: 'wizard',
    description: 'tall hat, beard',
    grid: [
      '.....hh.....',
      '.....hh.....',
      '....hhh.....',
      '....hghh....',
      '...hhhhh....',
      '..hhhhhhh...',
      '...ffffff...',
      '...fefeef...',
      '...appppa...',
      '...awwwwa...',
      '...awwwwa...',
      '...awwwwa...',
      '...appppa...',
      '...ll..ll...',
      '...bb..bb...',
    ],
    colors: { ...BASE, h: '#3a2257', g: '#f1d24f' },
  },
  diver: {
    id: 'diver',
    label: 'diver',
    description: 'snorkel, mask',
    grid: [
      '............',
      '............',
      '.......h....',
      '......hh....',
      '......hh....',
      '...ggggggi..',
      '..gmmgmmgi..',
      '...ffffff...',
      '...appppa...',
      '...apqqpa...',
      '...apqqpa...',
      '...appppa...',
      '...ll..ll...',
      '...ll..ll...',
      '...bb..bb...',
    ],
    colors: {
      ...BASE,
      h: '#f7b500',
      i: '#f7b500',
      g: '#1a1a1a',
      m: '#7adcff',
      q: '#7adcff',
    },
  },
  pilot: {
    id: 'pilot',
    label: 'pilot',
    description: 'goggles, scarf',
    grid: [
      '............',
      '....hhhh....',
      '...hhhhhh...',
      '...hhhhhh...',
      '...ffffff...',
      '..gggggggg..',
      '..gmmgmmgg..',
      '....ffff....',
      '..ssssssss..',
      '...appppa...',
      '...appppa...',
      '...appppa...',
      '...ll..ll...',
      '...ll..ll...',
      '...bb..bb...',
    ],
    colors: { ...BASE, h: '#3a2614', g: '#1a1a1a', m: '#9bbcd4', s: '#d6442f' },
  },
  skater: {
    id: 'skater',
    label: 'skater',
    description: 'backwards cap',
    grid: [
      '............',
      '............',
      '....hhhh....',
      '...hhhhhhh..',
      '...hhhhhh...',
      '...ffffff...',
      '...fefeef...',
      '....ffff....',
      '...appppa...',
      '...appppa...',
      '...appppa...',
      '...appppa...',
      '...ll..ll...',
      '...ll..ll...',
      '...bb..bb...',
    ],
    colors: { ...BASE, h: '#e9a423' },
  },
  knight: {
    id: 'knight',
    label: 'knight',
    description: 'helmet, crest',
    grid: [
      '.....ii.....',
      '.....ii.....',
      '.....ii.....',
      '...hhhhhh...',
      '..hhhhhhhh..',
      '..hhgghhhh..',
      '..hhhhhhhh..',
      '...hhhhhh...',
      '...appppa...',
      '...apwwpa...',
      '...apwwpa...',
      '...appppa...',
      '...ll..ll...',
      '...ll..ll...',
      '...bb..bb...',
    ],
    colors: { ...BASE, h: '#9aa3b2', g: '#0a0a0a', i: '#d6442f' },
  },
};

export const CHARACTER_IDS: CharacterId[] = [
  'chef',
  'astronaut',
  'detective',
  'wizard',
  'diver',
  'pilot',
  'skater',
  'knight',
];

export const DEFAULT_CHARACTER: CharacterId = 'chef';

export const IDENTITY_COLORS: ColorDef[] = [
  { id: 'rose', hex: '#e2536d' },
  { id: 'amber', hex: '#e08a3b' },
  { id: 'butter', hex: '#e9c443' },
  { id: 'leaf', hex: '#5fb04d' },
  { id: 'sea', hex: '#3aa8c4' },
  { id: 'cobalt', hex: '#4566d4' },
  { id: 'plum', hex: '#9a5cc7' },
  { id: 'fog', hex: '#8a8f99' },
];

export const DEFAULT_COLOR: ColorId = 'leaf';

export function colorHex(id: ColorId | string): string {
  const found = IDENTITY_COLORS.find((c) => c.id === id);
  return (found ?? IDENTITY_COLORS[3]).hex;
}

export function darken(hex: string, amt = 0.25): string {
  const h = hex.replace('#', '');
  const expanded =
    h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(expanded, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.max(0, Math.floor(r * (1 - amt)));
  g = Math.max(0, Math.floor(g * (1 - amt)));
  b = Math.max(0, Math.floor(b * (1 - amt)));
  return (
    '#' +
    [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
  );
}

export function getCharacterDef(id: CharacterId | string): CharacterDef {
  return CHARACTERS[id as CharacterId] ?? CHARACTERS.chef;
}

export function isCharacterId(id: string): id is CharacterId {
  return id in CHARACTERS;
}

export function isColorId(id: string): id is ColorId {
  return IDENTITY_COLORS.some((c) => c.id === id);
}
