import { describe, expect, test } from 'vitest';

import { createSpotifyLyricsCacheKey } from './cache-key';

describe('createSpotifyLyricsCacheKey', () => {
  test('creates a stable cache key for the same lyric lines', () => {
    const lines = [
      { timeMs: 0, original: 'Hello' },
      { timeMs: 1_000, original: 'World' },
    ];

    expect(createSpotifyLyricsCacheKey('spotify', 'zh-CN', lines)).toBe(
      createSpotifyLyricsCacheKey('spotify', 'zh-CN', lines),
    );
  });

  test('uses the target language as part of the cache key', () => {
    const lines = [{ timeMs: 0, original: 'Hello' }];

    expect(createSpotifyLyricsCacheKey('spotify', 'zh-CN', lines)).not.toBe(
      createSpotifyLyricsCacheKey('spotify', 'en-US', lines),
    );
  });

  test('does not include raw lyric text in the cache key', () => {
    const lines = [{ timeMs: 0, original: 'A very specific lyric line' }];

    expect(createSpotifyLyricsCacheKey('spotify', 'zh-CN', lines)).not.toContain(
      'A very specific lyric line',
    );
  });

  test('distinguishes line boundaries that would collide with newline joining', () => {
    const left = [
      { timeMs: 0, original: 'Hello' },
      { timeMs: 1_000, original: 'World' },
    ];
    const right = [{ timeMs: 0, original: 'Hello\nWorld' }];

    expect(createSpotifyLyricsCacheKey('spotify', 'zh-CN', left)).not.toBe(
      createSpotifyLyricsCacheKey('spotify', 'zh-CN', right),
    );
  });
});
