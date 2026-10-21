import { BOARD_COLORS } from '../game/colors';

// Static circular Simon board (ADR-1): a round container with a 2x2 grid of
// four semantic buttons and a decorative center disc. No game input yet (M1).
export function SimonBoard() {
  return (
    <div className="board" role="group" aria-label="לוח המשחק">
      {BOARD_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          className={`quadrant quadrant--${color.id}`}
          style={{ gridArea: color.gridArea }}
          aria-label={color.label}
          data-color={color.id}
        />
      ))}
      <div className="board__center" aria-hidden="true" />
    </div>
  );
}
