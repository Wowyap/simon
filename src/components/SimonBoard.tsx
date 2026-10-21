import type { KeyboardEvent, PointerEvent } from 'react';
import { BOARD_COLORS, type ColorId } from '../game/colors';

export type BoardMode = 'idle' | 'presenting' | 'input' | 'ended';

type SimonBoardProps = {
  mode: BoardMode;
  litColor: ColorId | null;
  onPressStart: (color: ColorId, pointerId: number | null) => void;
};

// Circular Simon board (ADR-1): a round container with a 2x2 grid of four semantic buttons
// and a decorative center disc. Input starts on pointerdown (ADR-2) and only in "input" mode.
// aria-disabled (not `disabled`) keeps pointer events flowing so a release is never lost.
export function SimonBoard({ mode, litColor, onPressStart }: SimonBoardProps) {
  const inputEnabled = mode === 'input';

  const handlePointerDown = (color: ColorId) => (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== undefined && event.button > 0) return;
    event.preventDefault();
    if (!inputEnabled) return;
    onPressStart(color, typeof event.pointerId === 'number' ? event.pointerId : null);
  };

  const handleKeyDown = (color: ColorId) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (event.repeat || !inputEnabled) return;
    onPressStart(color, null);
  };

  return (
    <div className={`board board--${mode}`} role="group" aria-label="לוח המשחק">
      {BOARD_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          className={`quadrant quadrant--${color.id}${litColor === color.id ? ' is-lit' : ''}`}
          style={{ gridArea: color.gridArea }}
          aria-label={color.label}
          aria-disabled={!inputEnabled}
          data-color={color.id}
          onPointerDown={handlePointerDown(color.id)}
          onKeyDown={handleKeyDown(color.id)}
          onContextMenu={(event) => event.preventDefault()}
        />
      ))}
      <div className="board__center" aria-hidden="true" />
    </div>
  );
}
