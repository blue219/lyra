import { readFile } from 'node:fs/promises';

const manifestPath = new URL(
  '../.output/chrome-mv3/manifest.json',
  import.meta.url,
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

assertEqual(manifest.manifest_version, 3, 'manifest version');
assertEqual(manifest.action?.default_state, 'disabled', 'action default state');
assertEqual(manifest.action?.default_popup, 'popup.html', 'popup path');
assertArray(
  manifest.permissions,
  ['storage', 'declarativeContent'],
  'permissions',
);
assertArray(
  manifest.host_permissions,
  [
    'https://i.scdn.co/*',
    'https://lrclib.net/*',
    'https://translate.googleapis.com/*',
  ],
  'host permissions',
);

const contentScript = manifest.content_scripts?.[0];
assertArray(
  contentScript?.matches,
  ['https://open.spotify.com/*'],
  'Spotify match',
);
assertArray(contentScript?.js, ['content-scripts/content.js'], 'content gate');

const resources = manifest.web_accessible_resources?.[0];
assertArray(resources?.matches, ['https://open.spotify.com/*'], 'WAR matches');
assertArray(resources?.resources, ['/content-scripts/esm/*'], 'WAR resources');

console.log('Manifest contract passed.');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertArray(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
