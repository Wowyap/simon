import { EndDialog } from '../components/EndDialog';
import { SimonBoard, type BoardMode } from '../components/SimonBoard';
import { TOTAL_ROUNDS } from '../game/colors';
import type { Game } from '../hooks/useGame';

type HomeScreenProps = {
  game: Game;
};

// Home (game) screen. Shows the stage, status, board and the action for the current game state (DESIGN §1.1).
export function HomeScreen({ game }: HomeScreenProps) {
  const { state, displayRound, litColor, endRevealed, audioError } = game;
  const { status } = state;
  const ended = status === 'won' || status === 'lost';

  const boardMode: BoardMode =
    status === 'presenting' ? 'presenting' : status === 'awaitingInput' ? 'input' : ended ? 'ended' : 'idle';

  const statusText =
    status === 'presenting' ? 'המשחק מציג את הרצף' : status === 'awaitingInput' ? 'התור שלך' : '';

  const hintText =
    status === 'presenting' ? 'המתן...' : status === 'awaitingInput' ? 'הקש על הצבעים לפי הסדר' : '';

  return (
    <section className="screen screen--home">
      <header className="screen__header">
        <h1 className="brand">סיימון</h1>
      </header>

      <p className="stage">
        שלב <bdi>{displayRound}</bdi> מתוך <bdi>{TOTAL_ROUNDS}</bdi>
      </p>
      <p className="status" aria-live="polite">
        {statusText}
      </p>

      <div className="board-area">
        <SimonBoard mode={boardMode} litColor={litColor} onPressStart={game.pressStart} />
        {ended && endRevealed && (
          <EndDialog
            outcome={status === 'won' ? 'win' : 'loss'}
            completedRounds={state.completedRounds}
            onConfirm={game.dismiss}
          />
        )}
      </div>

      <p className="hint">{hintText}</p>

      <div className="actions">
        {status === 'idle' && (
          <button type="button" className="btn btn--primary" onClick={() => void game.start()}>
            התחל משחק
          </button>
        )}
      </div>

      {audioError && status === 'idle' && (
        <p className="error-message" role="alert">
          לא הצלחנו להפעיל את הצלילים. לחצו שוב על "התחל משחק".
        </p>
      )}
    </section>
  );
}
