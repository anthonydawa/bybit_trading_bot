import { Drawing } from './drawingTypes';

const STORAGE_PREFIX = 'bybit_drawings_';

export function getStoredDrawings(symbol: string): Drawing[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${symbol}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`Failed to load drawings for ${symbol}:`, e);
  }
  return [];
}

export function saveStoredDrawings(symbol: string, drawings: Drawing[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${symbol}`, JSON.stringify(drawings));
  } catch (e) {
    console.warn(`Failed to save drawings for ${symbol}:`, e);
  }
}

export function clearStoredDrawings(symbol: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${symbol}`);
  } catch (e) {
    console.warn(`Failed to clear drawings for ${symbol}:`, e);
  }
}
