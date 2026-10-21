// Presentation pacing from DESIGN.md §1.1 ("קצב הצגת הרצף"). Identical for every round (no speed-up).

/** Highlight + tone duration of each color in the sequence. */
export const FLASH_MS = 600;
/** Pause between two consecutive sequence colors. */
export const GAP_MS = 250;
/** Wait before the first color after "התחל משחק". */
export const LEAD_IN_MS = 1000;
/** After a round is completed: the completed round number stays visible this long. */
export const ROUND_DONE_HOLD_MS = 1000;
/** After the next round number is shown: wait until its first color. */
export const NEXT_ROUND_LEAD_MS = 1000;
/** After the deciding press (wrong press, or last correct press of round 10): wait until the end dialog + sound. */
export const END_REVEAL_DELAY_MS = 1000;
/** Minimum highlight + tone of a player press (longer while the finger stays down). */
export const PRESS_MIN_MS = 300;
