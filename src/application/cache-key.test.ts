import { describe, expect, test } from 'vitest';

import {
  createFallbackCacheIdentity,
  createSpotifyLyricsCacheIdentity,
} from './cache-key';

describe('cache identity', () => {
  test('uses structured song and language identity', () => {
    const fallback = createFallbackCacheIdentity(
      { title: ' Song ', artists: ['Artist'], durationSeconds: 180 },
      'fr-FR',
    );
    expect(fallback.id).toBe(`lrclib::${fallback.songKey}::fr-FR`);
    expect(
      createFallbackCacheIdentity({ title: 'Song', artists: ['Artist'] }, null)
        .id,
    ).toContain('::original');
  });

  test('fingerprints Spotify text without parsing the key for grouping', () => {
    const first = createSpotifyLyricsCacheIdentity('spotify', 'fr-FR', [
      { timeMs: 0, original: 'Hello' },
    ]);
    const sameText = createSpotifyLyricsCacheIdentity('spotify', 'de-DE', [
      { timeMs: 99, original: 'Hello' },
    ]);
    const different = createSpotifyLyricsCacheIdentity('spotify', 'fr-FR', [
      { timeMs: 0, original: 'World' },
    ]);
    expect(first.songKey).toBe(sameText.songKey);
    expect(first.id).not.toBe(sameText.id);
    expect(different.songKey).not.toBe(first.songKey);
  });
});
