export type Screen = 'home' | 'about';

type BottomNavProps = {
  current: Screen;
  onNavigate: (screen: Screen) => void;
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 3.2 2.5 11.1l1.3 1.5L5 11.6V20a1 1 0 0 0 1 1h4.5v-6h3v6H18a1 1 0 0 0 1-1v-8.4l1.2 1 1.3-1.5Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1.2 15h-2.4v-6.5h2.4Zm-1.2-8.2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
  );
}

const ITEMS: { screen: Screen; label: string; Icon: () => React.JSX.Element }[] = [
  { screen: 'home', label: 'בית', Icon: HomeIcon },
  { screen: 'about', label: 'אודות', Icon: InfoIcon },
];

// Fixed two-tab navigation. Switching tabs only changes in-memory state; no page load.
export function BottomNav({ current, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="ניווט ראשי">
      {ITEMS.map(({ screen, label, Icon }) => {
        const active = current === screen;
        return (
          <button
            key={screen}
            type="button"
            className={`bottom-nav__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(screen)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
