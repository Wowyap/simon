import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages project path (ADR-8). Case-sensitive: must match the repository name.
export const BASE_PATH = '/Simon/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
