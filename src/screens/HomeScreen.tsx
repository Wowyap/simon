import { SimonBoard } from '../components/SimonBoard';
import { TOTAL_ROUNDS } from '../game/colors';

// Home (game) screen in its "before game start" state. Game logic arrives in M2.
export function HomeScreen() {
  return (
    <section className="screen screen--home">
      <header className="screen__header">
        <h1 className="brand">סיימון</h1>
      </header>

      <p className="stage">
        שלב <bdi>1</bdi> מתוך <bdi>{TOTAL_ROUNDS}</bdi>
      </p>
      <p className="status" aria-live="polite"></p>

      <SimonBoard />

      <div className="actions">
        <button type="button" className="btn btn--primary">
          התחל משחק
        </button>
      </div>
    </section>
  );
}
