// Single source of truth for the four game colors and their board layout.
// Layout follows the Mockups (DESIGN.md §1.1): it is spatial and must not flip in RTL.

export type ColorId = 'green' | 'red' | 'yellow' | 'blue';

export type BoardColor = {
  id: ColorId;
  /** Hebrew accessible name of the quadrant. */
  label: string;
  /** CSS grid-area name inside the 2x2 board grid. */
  gridArea: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
};

export const BOARD_COLORS: readonly BoardColor[] = [
  { id: 'green', label: 'ירוק', gridArea: 'top-left' },
  { id: 'red', label: 'אדום', gridArea: 'top-right' },
  { id: 'yellow', label: 'צהוב', gridArea: 'bottom-left' },
  { id: 'blue', label: 'כחול', gridArea: 'bottom-right' },
];

export const TOTAL_ROUNDS = 10;
