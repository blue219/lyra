import { describe, expect, test } from 'vitest';

import { LyricsCache } from './cache';
import type { LyricsResult } from './types';

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
  test('returns a cached lyrics result while the hit ttl is still valid', () => {
    const cache = new LyricsCache({
      hitTtlMs: 60_000,
      missTtlMs: 5_000,
    });

    cache.set('track-key', bilingualResult, 1_000);

    expect(cache.get('track-key', 30_000)).toEqual(bilingualResult);
  });

  test('expires unavailable results using the shorter miss ttl', () => {
    const cache = new LyricsCache({
      hitTtlMs: 60_000,
      missTtlMs: 5_000,
    });

    cache.set('track-key', unavailableResult, 1_000);

    expect(cache.get('track-key', 4_000)).toEqual(unavailableResult);
    expect(cache.get('track-key', 7_000)).toBeNull();
  });
});

