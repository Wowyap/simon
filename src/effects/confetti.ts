import confetti from 'canvas-confetti';

// Win-only confetti (DESIGN §2.4). With prefers-reduced-motion it is still shown, but reduced:
// one short burst with few particles. Never use `disableForReducedMotion` (it removes confetti entirely).

const COLORS = ['#00D26A', '#FF3B30', '#FFD600', '#00A3FF'];

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Fires the win confetti and returns a cleanup that stops and clears it. */
export function fireWinConfetti(): () => void {
  if (prefersReducedMotion()) {
    confetti({ particleCount: 25, spread: 70, startVelocity: 25, ticks: 60, gravity: 1.4, origin: { y: 0.45 }, colors: COLORS });
    return () => confetti.reset();
  }

  const burst = () => {
    confetti({ particleCount: 70, spread: 80, startVelocity: 40, origin: { x: 0.5, y: 0.45 }, colors: COLORS });
    confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: COLORS });
    confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: COLORS });
  };
  burst();
  const timers = [setTimeout(burst, 450), setTimeout(burst, 900)];
  return () => {
    timers.forEach(clearTimeout);
    confetti.reset();
  };
}
