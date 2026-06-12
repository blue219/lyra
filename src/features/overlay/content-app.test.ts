import { describe, expect, test } from 'vitest';

import { shouldRequestVisibleSpotifyLyrics } from './content-app';

describe('shouldRequestVisibleSpotifyLyrics', () => {
  test('does not request lyrics when Spotify lyrics are not visible', () => {
    expect(shouldRequestVisibleSpotifyLyrics([])).toBe(false);
  });
});
