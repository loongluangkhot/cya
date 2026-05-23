import type { ThemeDef, ThemeId } from './types';

export const THEMES: ThemeDef[] = [
  { id: 'midnight', name: 'Midnight', swatch: ['#2d3543', '#d68744'] },
  { id: 'forest', name: 'Forest', swatch: ['#3d5a40', '#c4a55b'] },
  { id: 'sky', name: 'Sky', swatch: ['#7ec5ff', '#3f8ad0'] },
  { id: 'mint', name: 'Mint', swatch: ['#7ed4a3', '#2f8a55'] },
  { id: 'lavender', name: 'Lavender', swatch: ['#c0a4f0', '#8a5cd6'] },
  { id: 'pink', name: 'Bubblegum', swatch: ['#ff8fb1', '#ff5fa1'] },
];

export const DEFAULT_THEME: ThemeId = 'midnight';
export const THEME_STORAGE_KEY = 'cya-theme';

export function loadStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && THEMES.some((t) => t.id === v)) return v;
  } catch {}
  return DEFAULT_THEME;
}

export function persistTheme(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {}
}

export function applyThemeToDocument(id: ThemeId): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = id;
  }
}
