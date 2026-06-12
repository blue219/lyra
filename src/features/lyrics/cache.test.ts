import { describe, expect, test } from 'vitest';

import { LyricsCache } from './cache';
import type { LyricsResult } from '../../shared/types';

const bilingualResult: LyricsResult = {
  status: 'bilingual',
  lines: [
    {
      timeMs: 1000,
      original: 'Hello',
      translated: '你好',
    },
  ],
};

const unavailableResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

describe('LyricsCache', () => {
  function createCache(maxEntries = 10): LyricsCache {
    return new LyricsCache({
      hitTtlMs: 60_000,
      missTtlMs: 5_000,
      maxEntries,
    });
  }

  test('returns a cached lyrics result while the hit ttl is still valid', () => {
    const cache = createCache();

    cache.set('track-key', bilingualResult, 1_000);

    expect(cache.get('track-key', 30_000)).toEqual(bilingualResult);
  });

  test('expires unavailable results using the shorter miss ttl', () => {
    const cache = createCache();

    cache.set('track-key', unavailableResult, 1_000);

    expect(cache.get('track-key', 4_000)).toEqual(unavailableResult);
    expect(cache.get('track-key', 7_000)).toBeNull();
  });

  test('getEntries returns all cached entries with keys and expiresAt', () => {
    const cache = createCache();

    cache.set('key-a', bilingualResult, 1_000);
    cache.set('key-b', unavailableResult, 2_000);

    const entries = cache.getEntries(3_000);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      key: 'key-a',
      expiresAt: 61_000,
      value: bilingualResult,
    });
    expect(entries[1]).toEqual({
      key: 'key-b',
      expiresAt: 7_000,
      value: unavailableResult,
    });
  });

  test('restore sets an entry with a pre-computed expiresAt', () => {
    const cache = createCache();

    expect(cache.restore('key-a', bilingualResult, 123_456, 100_000)).toBe(true);

    // Should be retrievable within expiresAt
    expect(cache.get('key-a', 100_000)).toEqual(bilingualResult);
    // But past expiresAt it becomes null
    expect(cache.get('key-a', 200_000)).toBeNull();
  });

  test('refreshes recently used entries before enforcing max entries', () => {
    const cache = createCache(2);

    cache.set('key-a', bilingualResult, 1_000);
    cache.set('key-b', bilingualResult, 2_000);
    expect(cache.get('key-a', 3_000)).toEqual(bilingualResult);

    cache.set('key-c', bilingualResult, 4_000);

    expect(cache.get('key-a', 5_000)).toEqual(bilingualResult);
    expect(cache.get('key-b', 5_000)).toBeNull();
    expect(cache.get('key-c', 5_000)).toEqual(bilingualResult);
  });

  test('getEntries removes expired entries before returning snapshots', () => {
    const cache = createCache();

    cache.set('expired', unavailableResult, 1_000);
    cache.set('fresh', bilingualResult, 2_000);

    expect(cache.getEntries(7_000)).toEqual([
      {
        key: 'fresh',
        expiresAt: 62_000,
        value: bilingualResult,
      },
    ]);
  });

  test('restore skips expired entries and returns false', () => {
    const cache = createCache();

    expect(cache.restore('expired', bilingualResult, 5_000, 5_000)).toBe(false);

    expect(cache.get('expired', 5_000)).toBeNull();
    expect(cache.getEntries(5_000)).toEqual([]);
  });

  test('set uses ttl overrides for degraded results', () => {
    const cache = createCache();

    cache.set('degraded', bilingualResult, 1_000, 2_000);

    expect(cache.get('degraded', 2_999)).toEqual(bilingualResult);
    expect(cache.get('degraded', 3_000)).toBeNull();
  });
});
