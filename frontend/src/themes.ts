import { safeLocalGet, safeLocalSet } from './storage';

// Personal theme presets. Each preset is a coherent set of the five
// user-controllable tokens (bg, fg, surface, surface-2, muted). Derived
// tokens (border, accent, scene-*) are computed from these in CSS via
// var() references.
//
// Theme is a per-device personal preference (brief: "preferences here do
// not propagate to other people in the space"), persisted in localStorage
// under cya:theme:v1.

export type ThemeId =
  | 'cream'
  | 'forest'
  | 'midnight'
  | 'sepia'
  | 'slate'
  | 'neon';

export interface ThemePreset {
  id: ThemeId;
  name: string;
  bg: string;
  fg: string;
  surface: string;
  surface2: string;
  muted: string;
}

export const THEMES: ThemePreset[] = [
  {
    id: 'cream',
    name: 'cream',
    bg: '#f6f5f1',
    fg: '#0a0a0a',
    surface: '#ffffff',
    surface2: '#eeece6',
    muted: '#6e6e6e',
  },
  {
    id: 'forest',
    name: 'forest',
    bg: '#e8efe4',
    fg: '#1c2a1f',
    surface: '#f1f5ed',
    surface2: '#d4ddce',
    muted: '#5a6e58',
  },
  {
    id: 'midnight',
    name: 'midnight',
    bg: '#1a1a1a',
    fg: '#f4f1ea',
    surface: '#262626',
    surface2: '#2e2e2e',
    muted: '#8a8780',
  },
  {
    id: 'sepia',
    name: 'sepia',
    bg: '#ece1cb',
    fg: '#2a1f12',
    surface: '#f5ebd7',
    surface2: '#e0d3b8',
    muted: '#7a6a4d',
  },
  {
    id: 'slate',
    name: 'slate',
    bg: '#dfe2e6',
    fg: '#15191e',
    surface: '#eceff2',
    surface2: '#cdd2d8',
    muted: '#5b6168',
  },
  {
    id: 'neon',
    name: 'neon',
    bg: '#0a100c',
    fg: '#5cff8a',
    surface: '#131c16',
    surface2: '#1d2a22',
    muted: '#4a8a6a',
  },
];

export const DEFAULT_THEME: ThemeId = 'cream';
export const THEME_STORAGE_KEY = 'cya:theme:v1';

export function isThemeId(id: string): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}

export function loadTheme(): ThemeId {
  const raw = safeLocalGet(THEME_STORAGE_KEY);
  if (raw && isThemeId(raw)) return raw;
  return DEFAULT_THEME;
}

export function saveTheme(id: ThemeId): void {
  safeLocalSet(THEME_STORAGE_KEY, id);
}

export function applyTheme(id: ThemeId): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = id;
  }
}
