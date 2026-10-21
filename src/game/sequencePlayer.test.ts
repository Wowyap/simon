import { playPresentation, AbortedError } from './sequencePlayer';
import type { ColorId } from './colors';

type Event = { t: number; what: string };

function setup(sequence: ColorId[], kind: 'start' | 'nextRound') {
  const events: Event[] = [];
  const t0 = Date.now();
  const controller = new AbortController();
  const promise = playPresentation({
    sequence,
    kind,
    signal: controller.signal,
    waitForPressEnd: () => Promise.resolve(),
    onDisplayRoundAdvance: () => events.push({ t: Date.now() - t0, what: 'advance' }),
    onHighlight: (c) => events.push({ t: Date.now() - t0, what: c ?? 'off' }),
    playTone: (c, ms) => events.push({ t: Date.now() - t0, what: `tone:${c}:${ms}` }),
  });
  return { events, controller, promise };
}

describe('playPresentation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('follows the DESIGN pacing at the start of a game', async () => {
    const { events, promise } = setup(['green', 'red'], 'start');
    await vi.advanceTimersByTimeAsync(5000);
    await promise;
    expect(events).toEqual([
      { t: 1000, what: 'green' },
      { t: 1000, what: 'tone:green:600' },
      { t: 1600, what: 'off' },
      { t: 1850, what: 'red' },
      { t: 1850, what: 'tone:red:600' },
      { t: 2450, what: 'off' },
    ]);
  });

  it('keeps the same pace in later rounds and advances the stage between rounds', async () => {
    const seq: ColorId[] = ['green', 'red', 'yellow', 'blue', 'green', 'red', 'yellow', 'blue', 'green'];
    const { events, promise } = setup(seq, 'nextRound');
    await vi.advanceTimersByTimeAsync(20000);
    await promise;
    expect(events[0]).toEqual({ t: 1000, what: 'advance' });
    const onTimes = events.filter((e) => seq.includes(e.what as ColorId)).map((e) => e.t);
    expect(onTimes[0]).toBe(2000);
    const gaps = onTimes.slice(1).map((t, i) => t - onTimes[i]);
    expect(new Set(gaps)).toEqual(new Set([850]));
  });

  it('stops immediately when aborted', async () => {
    const { events, controller, promise } = setup(['green', 'red', 'blue'], 'start');
    const settled = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1200); // green is lit
    controller.abort();
    expect(await settled).toBeInstanceOf(AbortedError);
    expect(events.at(-1)?.what).toBe('off');
    const count = events.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(events).toHaveLength(count);
  });
});
