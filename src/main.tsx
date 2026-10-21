import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Heebo is bundled locally (no Google Fonts) so it works offline. Only used weights.
import '@fontsource/heebo/400.css';
import '@fontsource/heebo/600.css';
import '@fontsource/heebo/700.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
