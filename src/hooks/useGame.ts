import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import * as audio from '../audio/audioEngine';
import type { ColorId } from '../game/colors';
import { gameReducer, initialGameState, willCompleteRound, type GameState } from '../game/gameReducer';
import { randomColor } from '../game/random';
import { abortable, playPresentation, sleep } from '../game/sequencePlayer';
import { END_REVEAL_DELAY_MS, PRESS_MIN_MS } from '../game/timing';

// Owns the game session (lives in App so screen switches do not unmount it, ADR-2).
// Connects the pure reducer with side effects: playback, audio, press feedback and the end dialog timing.

type ActivePress = {
  color: ColorId;
  /** null for keyboard presses (auto-released). */
  pointerId: number | null;
  released: boolean;
  minElapsed: boolean;
  minTimer: ReturnType<typeof setTimeout>;
  stopTone: () => void;
  done: Promise<void>;
  resolve: () => void;
};

export type Game = {
  state: GameState;
  /** Round number to show in "שלב X מתוך 10" (lags behind during the between-rounds wait). */
  displayRound: number;
  litColor: ColorId | null;
  /** The win/loss dialog is visible. */
  endRevealed: boolean;
  /** Audio could not be started; the game did not start. */
  audioError: boolean;
  start: () => Promise<void>;
  pressStart: (color: ColorId, pointerId: number | null) => void;
  dismiss: () => void;
  abandon: () => void;
};

export function useGame(homeVisible: boolean): Game {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [sequenceLit, setSequenceLit] = useState<ColorId | null>(null);
  const [pressLit, setPressLit] = useState<ColorId | null>(null);
  const [advancedPresentationId, setAdvancedPresentationId] = useState(-1);
  const [endRevealed, setEndRevealed] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // Latest state for event handlers (handlers run between renders).
  const stateRef = useRef(state);
  stateRef.current = state;

  const pressRef = useRef<ActivePress | null>(null);
  const startingRef = useRef(false);
  const revealedGameRef = useRef(-1);
  const leftDuringEndWaitRef = useRef(false);

  // ---------- Player press feedback ----------

  const finishPressIfDone = useCallback(() => {
    const press = pressRef.current;
    if (!press || !press.released || !press.minElapsed) return;
    pressRef.current = null;
    press.stopTone();
    setPressLit(null);
    press.resolve();
  }, []);

  const cancelPress = useCallback(() => {
    const press = pressRef.current;
    if (!press) return;
    pressRef.current = null;
    clearTimeout(press.minTimer);
    press.stopTone();
    setPressLit(null);
    press.resolve();
  }, []);

  const releasePointer = useCallback(
    (pointerId: number | undefined) => {
      const press = pressRef.current;
      if (!press || press.released) return;
      // Lifting a second (ignored) finger must not end the active press.
      if (press.pointerId !== null && pointerId !== undefined && pointerId !== press.pointerId) return;
      press.released = true;
      finishPressIfDone();
    },
    [finishPressIfDone],
  );

  const waitForPressEnd = useCallback(() => pressRef.current?.done ?? Promise.resolve(), []);

  const pressStart = useCallback(
    (color: ColorId, pointerId: number | null) => {
      const current = stateRef.current;
      // Single touch only (§2.3 rule 11); input only on the player's turn.
      if (pressRef.current || current.status !== 'awaitingInput') return;

      dispatch({
        type: 'press',
        color,
        nextColor: willCompleteRound(current, color) ? randomColor() : undefined,
      });

      // Feedback (highlight + tone) for every press, including a wrong one.
      let resolve: () => void = () => undefined;
      const done = new Promise<void>((r) => {
        resolve = r;
      });
      const press: ActivePress = {
        color,
        pointerId,
        released: pointerId === null,
        minElapsed: false,
        minTimer: setTimeout(() => {
          press.minElapsed = true;
          finishPressIfDone();
        }, PRESS_MIN_MS),
        stopTone: audio.startTone(color),
        done,
        resolve,
      };
      pressRef.current = press;
      setPressLit(color);
    },
    [finishPressIfDone],
  );

  // Release is tracked on window: the quadrant may stop accepting input before the finger lifts.
  useEffect(() => {
    const onRelease = (event: PointerEvent) => releasePointer(event.pointerId);
    window.addEventListener('pointerup', onRelease);
    window.addEventListener('pointercancel', onRelease);
    return () => {
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
    };
  }, [releasePointer]);

  // ---------- Sequence presentation ----------

  const { status, presentationId, presentationKind, sequence, round, gameId } = state;

  useEffect(() => {
    if (status !== 'presenting') return;
    const controller = new AbortController();
    playPresentation({
      sequence,
      kind: presentationKind,
      signal: controller.signal,
      waitForPressEnd,
      onDisplayRoundAdvance: () => setAdvancedPresentationId(presentationId),
      onHighlight: setSequenceLit,
      playTone: audio.playTone,
    }).then(
      () => {
        if (!controller.signal.aborted) dispatch({ type: 'presentationDone', presentationId });
      },
      () => {
        // Cancelled: nothing may change after abort.
      },
    );
    return () => {
      controller.abort();
      setSequenceLit(null);
      audio.stopAll();
    };
    // Each presentation is identified by presentationId; sequence/kind are fixed for it.
  }, [status, presentationId]);

  // ---------- End dialog (win / loss) ----------

  const revealEnd = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'won' && current.status !== 'lost') return;
    if (revealedGameRef.current === current.gameId) return;
    revealedGameRef.current = current.gameId;
    setEndRevealed(true);
    if (current.status === 'won') audio.playWinSound();
    else audio.playLoseSound();
  }, []);

  useEffect(() => {
    if ((status !== 'won' && status !== 'lost') || endRevealed) return;
    if (!homeVisible) {
      // The result is already decided; show it as soon as the player returns home.
      leftDuringEndWaitRef.current = true;
      return;
    }
    if (leftDuringEndWaitRef.current) {
      revealEnd();
      return;
    }
    const controller = new AbortController();
    (async () => {
      await abortable(waitForPressEnd(), controller.signal);
      await sleep(END_REVEAL_DELAY_MS, controller.signal);
      revealEnd();
    })().catch(() => {
      // Cancelled.
    });
    return () => controller.abort();
  }, [status, gameId, endRevealed, homeVisible, revealEnd, waitForPressEnd]);

  // ---------- Commands ----------

  const start = useCallback(async () => {
    if (stateRef.current.status !== 'idle' || startingRef.current) return;
    startingRef.current = true;
    setAudioError(false);
    // Called synchronously within the click gesture (autoplay policy).
    const ok = await audio.unlockAudio();
    startingRef.current = false;
    if (!ok) {
      // Never start a silent game that pretends to play sounds.
      setAudioError(true);
      return;
    }
    if (stateRef.current.status !== 'idle') return;
    leftDuringEndWaitRef.current = false;
    dispatch({ type: 'start', firstColor: randomColor() });
  }, []);

  const dismiss = useCallback(() => {
    leftDuringEndWaitRef.current = false;
    setEndRevealed(false);
    dispatch({ type: 'dismiss' });
  }, []);

  // Temporary (Milestone 2): leaving to "אודות" cancels the active game. Replaced by pause in M3.
  const abandon = useCallback(() => {
    const current = stateRef.current.status;
    if (current !== 'presenting' && current !== 'awaitingInput') return;
    cancelPress();
    audio.stopAll();
    setSequenceLit(null);
    dispatch({ type: 'abandon' });
  }, [cancelPress]);

  // Silence everything if the owner unmounts.
  useEffect(
    () => () => {
      cancelPress();
      audio.stopAll();
    },
    [cancelPress],
  );

  const displayRound =
    status === 'presenting' && presentationKind === 'nextRound' && advancedPresentationId !== presentationId
      ? round - 1
      : round;

  return {
    state,
    displayRound,
    litColor: pressLit ?? sequenceLit,
    endRevealed,
    audioError,
    start,
    pressStart,
    dismiss,
    abandon,
  };
}
