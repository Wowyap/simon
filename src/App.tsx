import { useState } from 'react';
import { BottomNav, type Screen } from './components/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { AboutScreen } from './screens/AboutScreen';

// App shell: two internal screens switched by in-memory state (no router, no reload).
// Game state will live here from M2 so that switching screens does not unmount it.
export function App() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <div className="app">
      <main className="app__main">{screen === 'home' ? <HomeScreen /> : <AboutScreen />}</main>
      <BottomNav current={screen} onNavigate={setScreen} />
    </div>
  );
}
