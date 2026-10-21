import { gameReducer, initialGameState, willCompleteRound, type GameState } from './gameReducer';
import type { ColorId } from './colors';

function started(first: ColorId = 'green'): GameState {
  return gameReducer(initialGameState, { type: 'start', firstColor: first });
}

function toInput(state: GameState): GameState {
  return gameReducer(state, { type: 'presentationDone', presentationId: state.presentationId });
}

/** Replays the whole current sequence correctly and adds `next` when the round completes. */
function completeRound(state: GameState, next: ColorId): GameState {
  let s = toInput(state);
  for (const color of s.sequence) {
    s = gameReducer(s, { type: 'press', color, nextColor: willCompleteRound(s, color) ? next : undefined });
  }
  return s;
}

describe('gameReducer', () => {
  it('starts round 1 with a single color', () => {
    const s = started('red');
    expect(s.status).toBe('presenting');
    expect(s.sequence).toEqual(['red']);
    expect(s.round).toBe(1);
    expect(s.completedRounds).toBe(0);
    expect(s.gameId).toBe(1);
    expect(s.presentationKind).toBe('start');
  });

  it('ignores start when a game is not idle', () => {
    const s = started();
    expect(gameReducer(s, { type: 'start', firstColor: 'blue' })).toBe(s);
  });

  it('ignores presses while presenting and stale presentation results', () => {
    const s = started();
    expect(gameReducer(s, { type: 'press', color: 'green' })).toBe(s);
    expect(gameReducer(s, { type: 'presentationDone', presentationId: s.presentationId - 1 })).toBe(s);
  });

  it('advances only the input index on a correct middle press', () => {
    let s = completeRound(started('green'), 'red'); // round 2: green, red
    s = toInput(s);
    s = gameReducer(s, { type: 'press', color: 'green' });
    expect(s.status).toBe('awaitingInput');
    expect(s.inputIndex).toBe(1);
    expect(s.round).toBe(2);
  });

  it('grows the sequence by exactly one color per round, keeping the previous one as a prefix', () => {
    const lengths: Record<number, number> = {};
    let s = started('green');
    lengths[s.round] = s.sequence.length;
    const extras: ColorId[] = ['green', 'red', 'yellow', 'blue', 'blue', 'green', 'red', 'yellow', 'blue'];
    for (const next of extras) {
      const before = s.sequence;
      s = completeRound(s, next);
      expect(s.sequence.slice(0, before.length)).toEqual(before);
      expect(s.sequence).toHaveLength(before.length + 1);
      expect(s.completedRounds).toBe(s.round - 1);
      expect(s.presentationKind).toBe('nextRound');
      lengths[s.round] = s.sequence.length;
    }
    expect(lengths[1]).toBe(1);
    expect(lengths[2]).toBe(2);
    expect(lengths[10]).toBe(10);
    // Repeated color allowed (green, green at the start).
    expect(s.sequence.slice(0, 2)).toEqual(['green', 'green']);
  });

  it('loses on the first color of round 1 with 0 completed rounds', () => {
    const s = gameReducer(toInput(started('green')), { type: 'press', color: 'red' });
    expect(s.status).toBe('lost');
    expect(s.completedRounds).toBe(0);
  });

  it('loses in an advanced round with round - 1 completed rounds', () => {
    let s = started('green');
    for (const next of ['red', 'yellow', 'blue', 'green'] as ColorId[]) s = completeRound(s, next);
    expect(s.round).toBe(5);
    s = toInput(s);
    s = gameReducer(s, { type: 'press', color: 'green' });
    s = gameReducer(s, { type: 'press', color: 'blue' }); // expected red
    expect(s.status).toBe('lost');
    expect(s.completedRounds).toBe(4);
    expect(s.round).toBe(5);
  });

  it('wins after round 10 with 10 completed rounds and never reaches round 11', () => {
    let s = started('green');
    for (let i = 0; i < 9; i += 1) s = completeRound(s, 'blue');
    expect(s.round).toBe(10);
    s = completeRound(s, 'red');
    expect(s.status).toBe('won');
    expect(s.completedRounds).toBe(10);
    expect(s.round).toBe(10);
    expect(s.sequence).toHaveLength(10);
    expect(gameReducer(s, { type: 'press', color: 'green', nextColor: 'red' })).toBe(s);
  });

  it('dismiss returns to idle and the next start gets a new game id', () => {
    const lost = gameReducer(toInput(started('green')), { type: 'press', color: 'red' });
    const idle = gameReducer(lost, { type: 'dismiss' });
    expect(idle.status).toBe('idle');
    expect(idle.sequence).toEqual([]);
    expect(idle.round).toBe(1);
    expect(idle.gameId).toBe(lost.gameId);
    const next = gameReducer(idle, { type: 'start', firstColor: 'yellow' });
    expect(next.gameId).toBe(lost.gameId + 1);
    expect(next.sequence).toEqual(['yellow']);
  });

  it('abandon cancels an active game but not a finished one', () => {
    const presenting = started();
    const a = gameReducer(presenting, { type: 'abandon' });
    expect(a.status).toBe('idle');
    expect(a.presentationId).toBeGreaterThan(presenting.presentationId);
    expect(gameReducer(toInput(started()), { type: 'abandon' }).status).toBe('idle');
    const lost = gameReducer(toInput(started('green')), { type: 'press', color: 'red' });
    expect(gameReducer(lost, { type: 'abandon' })).toBe(lost);
  });
});
