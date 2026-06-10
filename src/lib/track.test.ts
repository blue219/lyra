import { describe, expect, test } from 'vitest';

import { createTrackCacheKey, normalizeTrackIdentity } from './track';

describe('normalizeTrackIdentity', () => {
  test('trims and collapses whitespace across title artists and album', () => {
    expect(
      normalizeTrackIdentity({
        title: '  Yellow   ',
        artists: [' Coldplay ', '  '],
        album: ' Yellow   -   Single ',
      }),
    ).toEqual({
      title: 'Yellow',
      artists: ['Coldplay'],
      album: 'Yellow - Single',
    });
  });
});

describe('createTrackCacheKey', () => {
  test('creates a stable lowercase cache key from normalized metadata', () => {
    expect(
      createTrackCacheKey({
        title: 'Yellow',
        artists: ['Coldplay'],
        album: 'Yellow - Single',
      }),
    ).toBe('yellow__coldplay__yellow - single');
  });
});
