import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Lyra',
    description: 'View bilingual lyrics directly in Spotify Web Player.',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_icon: {
        16: 'icons/action-16.png',
        32: 'icons/action-32.png',
        48: 'icons/action-48.png',
        128: 'icons/action-128.png',
      },
    },
    permissions: ['storage'],
    host_permissions: [
      'https://lrclib.net/*',
      'https://translate.googleapis.com/*',
      'https://translator.bing.com/*',
      'https://www.bing.com/*',
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    test: {
      environment: 'node',
    },
  }),
});
