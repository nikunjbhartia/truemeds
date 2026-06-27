// web/vitest.config.js — separate from vite.config.js to avoid bundling test deps.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@fixtures': path.resolve(__dirname, 'src/tests/fixtures'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/js/**', 'src/components/**', 'src/hooks/**', '../functions/api/**'],
      thresholds: { lines: 85, branches: 80, functions: 90, statements: 85 },
    },
    testTimeout: 5000,
    pool: 'forks', // happy-dom + forks avoids cross-test contamination
  },
});
