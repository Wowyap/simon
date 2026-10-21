import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';
import type { ColorId } from './game/colors';
import { FLASH_MS, GAP_MS, PRESS_MIN_MS } from './game/timing';
import * as audio from './audio/audioEngine';
import { fireWinConfetti } from './effects/confetti';
import { randomColor } from './game/random';

vi.mock('./audio/audioEngine', () => ({
  unlockAudio: vi.fn(() => Promise.resolve(true)),
  startTone: vi.fn(() => vi.fn()),
  playTone: vi.fn(),
  playWinSound: vi.fn(),
  playLoseSound: vi.fn(),
  stopAll: vi.fn(),
}));
vi.mock('./effects/confetti', () => ({ fireWinConfetti: vi.fn(() => vi.fn()) }));
vi.mock('./game/random', () => ({ randomColor: vi.fn() }));

const LABEL: Record<ColorId, string> = { green: 'ירוק', red: 'אדום', yellow: 'צהוב', blue: 'כחול' };

let queue: ColorId[] = [];
function queueColors(...colors: ColorId[]) {
  queue.push(...colors);
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const playLength = (n: number) => n * FLASH_MS + (n - 1) * GAP_MS;
const quadrant = (color: ColorId) => screen.getByRole('button', { name: LABEL[color] });
const stageText = () => document.querySelector('.stage')?.textContent?.replace(/\s+/g, ' ').trim();
const statusText = () => document.querySelector('.status')?.textContent ?? '';
const litColors = () => Array.from(document.querySelectorAll('.quadrant.is-lit')).map((el) => el.getAttribute('data-color'));

async function clickStart() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'התחל משחק' }));
  });
}

/** Tap a quadrant: press, lift, and wait until the press feedback ends. */
async function tap(color: ColorId, pointerId = 1) {
  fireEvent.pointerDown(quadrant(color), { pointerId });
  fireEvent.pointerUp(window, { pointerId });
  await advance(PRESS_MIN_MS);
}

/** Replays `sequence` correctly. Leaves time at the end of the last press feedback. */
async function replay(sequence: ColorId[]) {
  for (const color of sequence) await tap(color);
}

describe('Game – Milestone 2', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queue = [];
    vi.mocked(randomColor).mockImplementation(() => {
      const next = queue.shift();
      if (!next) throw new Error('random queue empty');
      return next;
    });
    vi.mocked(audio.unlockAudio).mockImplementation(() => Promise.resolve(true));
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('starts on "התחל משחק", presents with input blocked, then gives the player the turn', async () => {
    queueColors('green');
    render(<App />);
    await clickStart();

    expect(audio.unlockAudio).toHaveBeenCalledTimes(1);
    expect(statusText()).toBe('המשחק מציג את הרצף');
    expect(screen.getByText('המתן...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'התחל משחק' })).not.toBeInTheDocument();
    expect(quadrant('green')).toHaveAttribute('aria-disabled', 'true');
    expect(stageText()).toBe('שלב 1 מתוך 10');

    await advance(1000);
    expect(litColors()).toEqual(['green']);
    expect(audio.playTone).toHaveBeenCalledWith('green', 600);

    // Pressing during the presentation does nothing.
    fireEvent.pointerDown(quadrant('red'), { pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(audio.startTone).not.toHaveBeenCalled();

    await advance(FLASH_MS);
    expect(litColors()).toEqual([]);
    expect(statusText()).toBe('התור שלך');
    expect(screen.getByText('הקש על הצבעים לפי הסדר')).toBeInTheDocument();
    expect(quadrant('green')).toHaveAttribute('aria-disabled', 'false');
  });

  it('advances to round 2 with the previous sequence as a prefix and the stage switching on schedule', async () => {
    queueColors('green', 'red');
    render(<App />);
    await clickStart();
    await advance(1000 + playLength(1));

    fireEvent.pointerDown(quadrant('green'), { pointerId: 1 });
    expect(audio.startTone).toHaveBeenCalledWith('green');
    expect(litColors()).toEqual(['green']);
    fireEvent.pointerUp(window, { pointerId: 1 });
    await advance(PRESS_MIN_MS);
    expect(litColors()).toEqual([]);

    expect(statusText()).toBe('המשחק מציג את הרצף');
    expect(stageText()).toBe('שלב 1 מתוך 10'); // completed round stays for 1000ms
    await advance(1000);
    expect(stageText()).toBe('שלב 2 מתוך 10');
    await advance(1000);
    expect(litColors()).toEqual(['green']);
    await advance(FLASH_MS + GAP_MS);
    expect(litColors()).toEqual(['red']);
    await advance(FLASH_MS);
    expect(statusText()).toBe('התור שלך');
  });

  it('keeps the press highlighted while the finger stays down', async () => {
    queueColors('green', 'red');
    render(<App />);
    await clickStart();
    await advance(1000 + playLength(1));

    fireEvent.pointerDown(quadrant('green'), { pointerId: 1 });
    await advance(800);
    expect(litColors()).toEqual(['green']);
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(litColors()).toEqual([]);
    // The between-rounds wait starts at the end of the press feedback.
    await advance(999);
    expect(stageText()).toBe('שלב 1 מתוך 10');
    await advance(1);
    expect(stageText()).toBe('שלב 2 מתוך 10');
  });

  it('loses on the first color of round 1: color tone now, loss sound + dialog 1s later, no confetti', async () => {
    queueColors('green');
    render(<App />);
    await clickStart();
    await advance(1000 + playLength(1));

    fireEvent.pointerDown(quadrant('red'), { pointerId: 1 });
    expect(audio.startTone).toHaveBeenCalledWith('red');
    fireEvent.pointerUp(window, { pointerId: 1 });
    await advance(PRESS_MIN_MS + 999);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(audio.playLoseSound).not.toHaveBeenCalled();

    await advance(1);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('נפסלת!')).toBeInTheDocument();
    expect(within(dialog).getByText('לא השלמת אף שלב')).toBeInTheDocument();
    expect(audio.playLoseSound).toHaveBeenCalledTimes(1);
    expect(audio.playWinSound).not.toHaveBeenCalled();
    expect(fireWinConfetti).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'אישור' })).toHaveFocus();
    expect(stageText()).toBe('שלב 1 מתוך 10');
  });

  it('loses in an advanced round showing the number of completed rounds', async () => {
    const seq: ColorId[] = ['green', 'red', 'yellow', 'blue'];
    queueColors(...seq);
    render(<App />);
    await clickStart();
    await advance(1000 + playLength(1));
    for (let round = 1; round <= 3; round += 1) {
      await replay(seq.slice(0, round));
      await advance(2000 + playLength(round + 1));
    }
    expect(stageText()).toBe('שלב 4 מתוך 10');
    await tap('green');
    await tap('red');
    await tap('green'); // expected yellow
    await advance(1000);
    expect(within(screen.getByRole('dialog')).getByText('השלמת 3 שלבים')).toBeInTheDocument();
    expect(stageText()).toBe('שלב 4 מתוך 10');
    expect(fireWinConfetti).not.toHaveBeenCalled();
  });

  it('wins after round 10 with sound and confetti, never reaches round 11, and "אישור" + start begins a new sequence', async () => {
    const seq: ColorId[] = ['green', 'green', 'red', 'yellow', 'blue', 'red', 'green', 'blue', 'yellow', 'red'];
    queueColors(...seq);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    await clickStart();
    await advance(1000 + playLength(1));
    for (let round = 1; round <= 9; round += 1) {
      await replay(seq.slice(0, round));
      await advance(2000 + playLength(round + 1));
    }
    expect(stageText()).toBe('שלב 10 מתוך 10');
    await replay(seq);
    expect(randomColor).toHaveBeenCalledTimes(10); // no color for an 11th round
    await advance(1000);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('כל הכבוד!');
    expect(dialog).toHaveTextContent('ניצחת!');
    expect(audio.playWinSound).toHaveBeenCalledTimes(1);
    expect(fireWinConfetti).toHaveBeenCalledTimes(1);
    expect(stageText()).toBe('שלב 10 מתוך 10');

    await advance(10000);
    expect(stageText()).toBe('שלב 10 מתוך 10');

    // No active game state is ever persisted.
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();

    fireEvent.click(within(dialog).getByRole('button', { name: 'אישור' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stageText()).toBe('שלב 1 מתוך 10');

    queueColors('blue');
    await clickStart();
    await advance(1000);
    expect(litColors()).toEqual(['blue']);
  });

  it('shows an error and does not start when audio cannot be started', async () => {
    vi.mocked(audio.unlockAudio).mockImplementation(() => Promise.resolve(false));
    render(<App />);
    await clickStart();
    expect(screen.getByRole('alert')).toHaveTextContent('לא הצלחנו להפעיל את הצלילים. לחצו שוב על "התחל משחק".');
    expect(screen.getByRole('button', { name: 'התחל משחק' })).toBeInTheDocument();
    expect(statusText()).toBe('');
    expect(randomColor).not.toHaveBeenCalled();

    // Retry from the same button succeeds.
    vi.mocked(audio.unlockAudio).mockImplementation(() => Promise.resolve(true));
    queueColors('yellow');
    await clickStart();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(statusText()).toBe('המשחק מציג את הרצף');
  });

  it.each([
    ['while presenting', 1300],
    ["on the player's turn", 1000 + FLASH_MS + 10],
  ])('leaving to "אודות" %s cancels the game with no light, sound or timer left', async (_, wait) => {
    queueColors('green');
    render(<App />);
    await clickStart();
    await advance(wait);
    const nav = screen.getByRole('navigation', { name: 'ניווט ראשי' });

    fireEvent.click(within(nav).getByRole('button', { name: 'אודות' }));
    expect(audio.stopAll).toHaveBeenCalled();
    await advance(10000);
    fireEvent.click(within(nav).getByRole('button', { name: 'בית' }));

    expect(screen.getByRole('button', { name: 'התחל משחק' })).toBeInTheDocument();
    expect(stageText()).toBe('שלב 1 מתוך 10');
    expect(statusText()).toBe('');
    expect(litColors()).toEqual([]);
    const tones = vi.mocked(audio.playTone).mock.calls.length;
    await advance(10000);
    expect(vi.mocked(audio.playTone).mock.calls.length).toBe(tones);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('accepts only one finger at a time', async () => {
    queueColors('green', 'red', 'blue');
    render(<App />);
    await clickStart();
    await advance(1000 + playLength(1));
    await tap('green');
    await advance(2000 + playLength(2));
    expect(statusText()).toBe('התור שלך');

    fireEvent.pointerDown(quadrant('green'), { pointerId: 1 });
    fireEvent.pointerDown(quadrant('red'), { pointerId: 2 }); // ignored
    fireEvent.pointerUp(window, { pointerId: 2 });
    expect(litColors()).toEqual(['green']);
    fireEvent.pointerUp(window, { pointerId: 1 });
    await advance(PRESS_MIN_MS);
    expect(audio.startTone).toHaveBeenCalledTimes(2);
    expect(statusText()).toBe('התור שלך');
    expect(stageText()).toBe('שלב 2 מתוך 10');

    await tap('red');
    expect(statusText()).toBe('המשחק מציג את הרצף');
  });
});
