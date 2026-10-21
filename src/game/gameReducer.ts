import { TOTAL_ROUNDS, type ColorId } from './colors';

// Pure game state machine (ARCHITECTURE §2.3). No audio, timers or storage here.

export type GameStatus = 'idle' | 'presenting' | 'awaitingInput' | 'won' | 'lost';
export type PresentationKind = 'start' | 'nextRound';

export type GameState = {
  status: GameStatus;
  /** Colors of the current game, length 1–10 (empty in idle). */
  sequence: ColorId[];
  /** Current round, 1–10 (1 in idle). */
  round: number;
  /** Index of the next expected press in the current round. */
  inputIndex: number;
  /** Rounds completed successfully, 0–10. */
  completedRounds: number;
  /** Incremented on every new game; guards one-time side effects per game. */
  gameId: number;
  /** Incremented on every new presentation or cancellation; stale playback results are ignored. */
  presentationId: number;
  presentationKind: PresentationKind;
};

export type GameAction =
  | { type: 'start'; firstColor: ColorId }
  | { type: 'presentationDone'; presentationId: number }
  /** nextColor is required only when the press completes rounds 1–9 (see willCompleteRound). */
  | { type: 'press'; color: ColorId; nextColor?: ColorId }
  | { type: 'dismiss' }
  /** Temporary (Milestone 2 only, ADR-3): leaving to "אודות" cancels the active game. Replaced by pause in M3. */
  | { type: 'abandon' };

export const initialGameState: GameState = {
  status: 'idle',
  sequence: [],
  round: 1,
  inputIndex: 0,
  completedRounds: 0,
  gameId: 0,
  presentationId: 0,
  presentationKind: 'start',
};

/** True when pressing `color` now would complete a round that is followed by another round. */
export function willCompleteRound(state: GameState, color: ColorId): boolean {
  return (
    state.status === 'awaitingInput' &&
    state.sequence[state.inputIndex] === color &&
    state.inputIndex === state.sequence.length - 1 &&
    state.round < TOTAL_ROUNDS
  );
}

function backToIdle(state: GameState): GameState {
  return {
    ...initialGameState,
    gameId: state.gameId,
    presentationId: state.presentationId + 1,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'start': {
      if (state.status !== 'idle') return state;
      return {
        ...initialGameState,
        status: 'presenting',
        sequence: [action.firstColor],
        gameId: state.gameId + 1,
        presentationId: state.presentationId + 1,
        presentationKind: 'start',
      };
    }

    case 'presentationDone': {
      if (state.status !== 'presenting' || action.presentationId !== state.presentationId) return state;
      return { ...state, status: 'awaitingInput', inputIndex: 0 };
    }

    case 'press': {
      if (state.status !== 'awaitingInput') return state;

      // Wrong color: immediate loss, no retry.
      if (state.sequence[state.inputIndex] !== action.color) {
        return { ...state, status: 'lost', completedRounds: state.round - 1 };
      }

      // Correct, round not finished yet.
      if (state.inputIndex < state.sequence.length - 1) {
        return { ...state, inputIndex: state.inputIndex + 1 };
      }

      // Correct and last of round 10: win. There is no round 11.
      if (state.round >= TOTAL_ROUNDS) {
        return { ...state, status: 'won', completedRounds: TOTAL_ROUNDS, inputIndex: 0 };
      }

      // Correct and last of rounds 1–9: move straight to the next round's presentation (§2.3 rule 10).
      if (!action.nextColor) return state;
      return {
        ...state,
        status: 'presenting',
        completedRounds: state.round,
        round: state.round + 1,
        sequence: [...state.sequence, action.nextColor],
        inputIndex: 0,
        presentationId: state.presentationId + 1,
        presentationKind: 'nextRound',
      };
    }

    case 'dismiss': {
      if (state.status !== 'won' && state.status !== 'lost') return state;
      return backToIdle(state);
    }

    case 'abandon': {
      if (state.status !== 'presenting' && state.status !== 'awaitingInput') return state;
      return backToIdle(state);
    }

    default:
      return state;
  }
}
