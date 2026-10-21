// About screen: short explanation, instructions and the (still empty) history area.
// Real history and the "delete history" button arrive in M4.
export function AboutScreen() {
  return (
    <section className="screen screen--about">
      <header className="screen__header">
        <h1 className="brand">אודות</h1>
      </header>

      <section className="card" aria-labelledby="about-game-title">
        <h2 id="about-game-title" className="card__title">
          על המשחק
        </h2>
        <p>סיימון הוא משחק זיכרון של צבעים וצלילים.</p>
        <p>זכרו את רצף הצבעים שמוצג, ולחצו על הצבעים באותו הסדר.</p>
        <p>בכל שלב נוסף צבע אחד. טעות אחת מסיימת את המשחק.</p>
        <p>
          נסו להגיע עד שלב <bdi>10</bdi>!
        </p>
      </section>

      <section className="history" aria-labelledby="history-title">
        <h2 id="history-title" className="section-title">
          10 המשחקים האחרונים
        </h2>
        <p className="empty-state">עדיין אין משחקים שמורים.</p>
      </section>
    </section>
  );
}
