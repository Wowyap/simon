import { useState } from 'react';
import { BottomNav, type Screen } from './components/BottomNav';
import { useGame } from './hooks/useGame';
import { HomeScreen } from './screens/HomeScreen';
import { AboutScreen } from './screens/AboutScreen';

// App shell: two internal screens switched by in-memory state (no router, no reload).
// The game session lives here so switching screens does not unmount it.
export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const game = useGame(screen === 'home');

  const navigate = (next: Screen) => {
    // Temporary (Milestone 2): leaving an active game cancels it. Replaced by pause in M3.
    if (next === 'about') game.abandon();
    setScreen(next);
  };

  return (
    <div className="app">
      <main className="app__main">{screen === 'home' ? <HomeScreen game={game} /> : <AboutScreen />}</main>
      <BottomNav current={screen} onNavigate={navigate} />
    </div>
  );
}
