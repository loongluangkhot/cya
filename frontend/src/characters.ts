import {
  SLIME_GRID,
  BLOB_PINK_GRID,
  CHICK_YELLOW_GRID,
  DINO_GREEN_GRID,
  CAT_BLUE_GRID,
  GHOST_PURPLE_GRID,
  FOX_ORANGE_GRID,
  PANDA_RED_GRID,
  BUNNY_WHITE_GRID,
} from './pixelGrids';
import type {
  CharacterCollection,
  CharacterDef,
  CharacterId,
  ColorMap,
} from './types';

const COMMON: ColorMap = {
  O: '#ffffff',
  E: '#1a1a1a',
  W: '#ffffff',
  M: '#1a1a1a',
};

const SLIME_COMMON: ColorMap = {
  ...COMMON,
  H: 'rgba(255, 255, 255, 0.55)',
};

function slime(
  id: CharacterId,
  name: string,
  body: string,
  dark: string,
): CharacterDef {
  return {
    id,
    name,
    type: 'pixel',
    color: body,
    grid: SLIME_GRID,
    colors: { ...SLIME_COMMON, B: body, K: dark },
  };
}

function tama(
  id: CharacterId,
  name: string,
  grid: readonly string[],
  color: string,
  extra: ColorMap,
): CharacterDef {
  return {
    id,
    name,
    type: 'pixel',
    color,
    grid,
    colors: { ...COMMON, ...extra, B: extra.B ?? color },
  };
}

export const COLLECTIONS: CharacterCollection[] = [
  {
    id: 'slimes',
    name: 'Slime Monsters',
    characters: [
      slime('slime-blue', 'Cobalt', '#5fa5d6', '#3d7ba8'),
      slime('slime-green', 'Mossy', '#7eb845', '#558524'),
      slime('slime-pink', 'Rosy', '#d6557a', '#9a3354'),
      slime('slime-yellow', 'Sunny', '#e0a82e', '#a87a14'),
      slime('slime-purple', 'Plum', '#9670c9', '#6a4699'),
      slime('slime-cyan', 'Frosty', '#5fc7c0', '#358e88'),
    ],
  },
  {
    id: 'tamagotchi',
    name: 'Tamagotchi Buddies',
    characters: [
      tama('blob-pink', 'Pinkblob', BLOB_PINK_GRID, '#ff7eb6', {
        K: '#c93f7d',
        B: '#ff7eb6',
        H: '#ffd2e3',
        C: '#ff3a8a',
      }),
      tama('chick-yellow', 'Chickie', CHICK_YELLOW_GRID, '#ffd84d', {
        K: '#a87a14',
        B: '#ffd84d',
        H: '#fff0b3',
        A: '#ff8a30',
        C: '#ff8aaa',
      }),
      tama('dino-green', 'Dino', DINO_GREEN_GRID, '#5fb850', {
        K: '#2f6a30',
        B: '#5fb850',
        H: '#a8e09e',
        S: '#3a8a3c',
        M: '#2f4a2f',
      }),
      tama('cat-blue', 'Bluecat', CAT_BLUE_GRID, '#5fa5d6', {
        K: '#1d5285',
        B: '#5fa5d6',
        H: '#a8d0f0',
      }),
      tama('ghost-purple', 'Spook', GHOST_PURPLE_GRID, '#9670c9', {
        K: '#4d2f88',
        B: '#9670c9',
        H: '#c9b0e6',
        M: '#3a1d6a',
      }),
      tama('fox-orange', 'Foxie', FOX_ORANGE_GRID, '#e88a3e', {
        K: '#8c4416',
        B: '#e88a3e',
        H: '#ffc89a',
        A: '#fff0d6',
      }),
      tama('panda-red', 'Pandee', PANDA_RED_GRID, '#a55540', {
        K: '#5e2618',
        B: '#a55540',
        H: '#d68872',
        A: '#3a1810',
      }),
      tama('bunny-white', 'Bunbun', BUNNY_WHITE_GRID, '#f0f0f0', {
        K: '#8a8a8a',
        B: '#f5f5f5',
        H: '#ffffff',
        A: '#ffb1d2',
      }),
    ],
  },
];

export const ALL_CHARACTERS: CharacterDef[] = COLLECTIONS.flatMap(
  (c) => c.characters,
);

export const DEFAULT_CHARACTER: CharacterId =
  COLLECTIONS[0].characters[0].id;

export const CHARACTERS = ALL_CHARACTERS;

export function getCharacterDef(id: CharacterId): CharacterDef | undefined {
  return ALL_CHARACTERS.find((c) => c.id === id);
}

export function characterColor(id: CharacterId): string {
  return getCharacterDef(id)?.color ?? '#666';
}
