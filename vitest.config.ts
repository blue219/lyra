import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  define: {
    __LYRA_VERSION__: JSON.stringify('1.0.0'),
  },
  plugins: [tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/testing/**',
        // Playwright covers browser lifecycle, GPU composition, and DOM scrolling.
        'src/ui/overlay/aurora-background.tsx',
        'src/ui/overlay/content-app.tsx',
        'src/ui/overlay/legacy-cleanup.ts',
        'src/ui/overlay/replacement-host.ts',
        'src/ui/overlay/replacement-scroll.ts',
        'src/ui/overlay/settings-entry.tsx',
        'src/ui/settings/use-lyrics-cache-summary.ts',
        'src/ui/settings/use-overlay-settings.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
        'src/domain/**': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 85,
        },
        'src/application/**': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 85,
        },
      },
    },
  },
});
