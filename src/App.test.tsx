import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { BOARD_COLORS } from './game/colors';
import indexHtml from '../index.html?raw';

function getNav() {
  return screen.getByRole('navigation', { name: 'ניווט ראשי' });
}

describe('App – Milestone 1', () => {
  it('renders the home screen before a game starts', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'סיימון' })).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /^שלב\s*1\s*מתוך\s*10$/.test(el.textContent ?? '')),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחל משחק' })).toBeInTheDocument();
    for (const name of ['ירוק', 'אדום', 'צהוב', 'כחול']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('places the quadrants according to the Mockups layout', () => {
    render(<App />);
    const expected: Record<string, string> = {
      ירוק: 'top-left',
      אדום: 'top-right',
      צהוב: 'bottom-left',
      כחול: 'bottom-right',
    };
    for (const color of BOARD_COLORS) {
      const button = screen.getByRole('button', { name: color.label });
      expect(button.style.gridArea).toBe(expected[color.label]);
    }
  });

  it('navigates to the about screen without a page load', async () => {
    const user = userEvent.setup();
    const hrefBefore = window.location.href;
    render(<App />);

    await user.click(within(getNav()).getByRole('button', { name: 'אודות' }));

    expect(screen.getByRole('heading', { level: 1, name: 'אודות' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'על המשחק' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '10 המשחקים האחרונים' })).toBeInTheDocument();
    expect(screen.getByText('עדיין אין משחקים שמורים.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'מחק היסטוריה' })).not.toBeInTheDocument();
    expect(within(getNav()).getByRole('button', { name: 'אודות' })).toHaveAttribute('aria-current', 'page');
    expect(within(getNav()).getByRole('button', { name: 'בית' })).not.toHaveAttribute('aria-current');
    expect(window.location.href).toBe(hrefBefore);
  });

  it('returns to the home screen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(getNav()).getByRole('button', { name: 'אודות' }));
    await user.click(within(getNav()).getByRole('button', { name: 'בית' }));

    expect(screen.getByRole('button', { name: 'התחל משחק' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'לוח המשחק' })).toBeInTheDocument();
    expect(within(getNav()).getByRole('button', { name: 'בית' })).toHaveAttribute('aria-current', 'page');
  });

  it('has exactly two screens in the navigation', () => {
    render(<App />);
    expect(within(getNav()).getAllByRole('button')).toHaveLength(2);
  });

  it('declares Hebrew and RTL in index.html', () => {
    const html = indexHtml;
    expect(html).toMatch(/<html[^>]*lang="he"/);
    expect(html).toMatch(/<html[^>]*dir="rtl"/);
    expect(html).toContain('<title>סיימון</title>');
    expect(html).not.toMatch(/fonts\.googleapis/);
  });
});
