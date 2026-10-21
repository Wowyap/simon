import type { ColorId } from './colors';
import type { PresentationKind } from './gameReducer';
import { FLASH_MS, GAP_MS, LEAD_IN_MS, NEXT_ROUND_LEAD_MS, ROUND_DONE_HOLD_MS } from './timing';

// Sequence Controller timing (DESIGN §1.1). Every wait is cancellable through an AbortSignal (§2.3 rule 5).

export class AbortedError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortedError';
  }
}

/** Resolves after `ms`, or rejects immediately (and clears the timer) when the signal is aborted. */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new AbortedError());
  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

/** Races a promise against an AbortSignal. */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new AbortedError());
  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(new AbortedError());
    signal.addEventListener('abort', handleAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', handleAbort);
        if (signal.aborted) reject(new AbortedError());
        else resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      },
    );
  });
}

export type PlayPresentationOptions = {
  sequence: readonly ColorId[];
  kind: PresentationKind;
  signal: AbortSignal;
  /** Resolves when the current player press feedback ends (immediately if there is none). */
  waitForPressEnd: () => Promise<void>;
  /** Called when the stage indicator should switch from the completed round to the next one. */
  onDisplayRoundAdvance: () => void;
  onHighlight: (color: ColorId | null) => void;
  playTone: (color: ColorId, durationMs: number) => void;
};

/** Plays one presentation. Rejects with AbortedError if cancelled; never touches state after abort. */
export async function playPresentation(options: PlayPresentationOptions): Promise<void> {
  const { sequence, kind, signal, waitForPressEnd, onDisplayRoundAdvance, onHighlight, playTone } = options;

  // Waits after a player press are measured from the end of the press feedback.
  await abortable(waitForPressEnd(), signal);

  if (kind === 'nextRound') {
    await sleep(ROUND_DONE_HOLD_MS, signal);
    onDisplayRoundAdvance();
    await sleep(NEXT_ROUND_LEAD_MS, signal);
  } else {
    await sleep(LEAD_IN_MS, signal);
  }

  for (let i = 0; i < sequence.length; i += 1) {
    const color = sequence[i];
    onHighlight(color);
    playTone(color, FLASH_MS);
    try {
      await sleep(FLASH_MS, signal);
    } finally {
      onHighlight(null);
    }
    if (i < sequence.length - 1) await sleep(GAP_MS, signal);
  }
}
