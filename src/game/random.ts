import { COLOR_IDS, type ColorId } from './colors';

// Game-only randomness (no crypto needed). Kept in its own module so tests can replace it (ADR-2).
export function randomColor(): ColorId {
  return COLOR_IDS[Math.floor(Math.random() * COLOR_IDS.length)];
}
