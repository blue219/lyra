import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const libreTranslateHostPermission = getLibreTranslateHostPermission();

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
      'http://localhost:5000/*',
      ...(libreTranslateHostPermission ? [libreTranslateHostPermission] : []),
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    test: {
      environment: 'node',
    },
  }),
});

function getLibreTranslateHostPermission(): string | undefined {
  const baseUrl =
    process.env.VITE_LIBRETRANSLATE_BASE_URL ?? readEnvValue('VITE_LIBRETRANSLATE_BASE_URL');

  if (!baseUrl) {
    return undefined;
  }

  try {
    const url = new URL(baseUrl);
    return `${url.origin}/*`;
  } catch {
    return undefined;
  }
}

function readEnvValue(name: string): string | undefined {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return undefined;
  }

  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((nextLine) => nextLine.trimStart().startsWith(`${name}=`));

  const value = line?.slice(line.indexOf('=') + 1).trim();
  return value || undefined;
}
