import type { BackgroundDef, BackgroundId } from './types';

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'lcd', name: 'LCD' },
  { id: 'classroom', name: 'Classroom' },
  { id: 'downtown', name: 'Downtown' },
  { id: 'farm', name: 'Farm' },
  { id: 'themepark', name: 'Theme Park' },
];

export const DEFAULT_BACKGROUND: BackgroundId = 'lcd';
export const BACKGROUND_STORAGE_KEY = 'cya-background';

export function loadStoredBackground(): BackgroundId {
  try {
    const v = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    if (v && BACKGROUNDS.some((b) => b.id === v)) return v as BackgroundId;
  } catch {}
  return DEFAULT_BACKGROUND;
}

export function persistBackground(id: BackgroundId): void {
  try {
    localStorage.setItem(BACKGROUND_STORAGE_KEY, id);
  } catch {}
}
