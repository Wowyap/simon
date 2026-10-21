import { useEffect, useRef } from 'react';
import { fireWinConfetti } from '../effects/confetti';

type EndDialogProps = {
  outcome: 'win' | 'loss';
  completedRounds: number;
  onConfirm: () => void;
};

/** Hebrew text for the number of completed rounds in the loss dialog (DESIGN §1.1). */
export function completedRoundsText(count: number): string {
  if (count === 0) return 'לא השלמת אף שלב';
  if (count === 1) return 'השלמת שלב אחד';
  return `השלמת ${count} שלבים`;
}

// Win/loss dialog shown over the board. Focus goes to "אישור"; confetti on win only.
export function EndDialog({ outcome, completedRounds, onConfirm }: EndDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outcome !== 'win') return;
    return fireWinConfetti();
  }, [outcome]);

  return (
    <div className="end-overlay">
      <div className="end-dialog" role="dialog" aria-modal="true" aria-labelledby="end-dialog-title">
        {outcome === 'win' ? (
          <h2 id="end-dialog-title" className="end-dialog__title">
            <span className="end-dialog__title--win">כל הכבוד!</span> <span>ניצחת!</span>
          </h2>
        ) : (
          <>
            <h2 id="end-dialog-title" className="end-dialog__title end-dialog__title--loss">
              נפסלת!
            </h2>
            <p className="end-dialog__detail">{completedRoundsText(completedRounds)}</p>
          </>
        )}
        <button ref={confirmRef} type="button" className="btn btn--primary" onClick={onConfirm}>
          אישור
        </button>
      </div>
    </div>
  );
}
