import { describe, expect, test } from 'vitest';

import type { LyricsCacheEntryV2 } from '@/src/domain/cache';
import { LyricsCache } from './cache';

function entry(id: string, expiresAt: number | null = 100): LyricsCacheEntryV2 {
  return {
    version: 2,
    id,
    songKey: `song-${id}`,
    source: 'lrclib',
    targetLanguage: null,
    expiresAt,
    lastAccessedAt: 0,
    result: { status: 'unavailable', reason: 'not-found', lines: [] },
  };
}

describe('LyricsCache', () => {
  test('keeps permanent entries while expiring temporary entries', () => {
    const cache = new LyricsCache(2);
    expect(cache.get('missing', 0)).toBeNull();
    expect(cache.restore(entry('expired', 1), 1)).toBe(false);
    expect(cache.restore(entry('a'), 0)).toBe(true);
    cache.set(entry('b'));
    expect(cache.get('a', 20)).toEqual(entry('a').result);
    cache.set(entry('c'));
    expect(cache.get('b', 20)).toBeNull();
    expect(cache.getEntries(20).map(({ id }) => id)).toEqual(['a', 'c']);
    cache.set(entry('soon', 21));
    expect(cache.get('soon', 21)).toBeNull();
    expect(cache.getEntries(200)).toEqual([]);
    cache.set(entry('permanent', null));
    expect(cache.get('permanent', 200)).toEqual(
      entry('permanent', null).result,
    );
    cache.set(entry('last', 300));
    cache.clear();
    expect(cache.getEntries(0)).toEqual([]);
  });
});
