import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Lyra',
    description: 'View bilingual lyrics directly in Spotify Web Player.',
    permissions: ['storage'],
    host_permissions: ['https://lrclib.net/*', 'http://154.44.10.127:5000/*'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    test: {
      environment: 'node',
    },
  }),
});
