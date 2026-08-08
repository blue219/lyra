import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchLyricsFromLrclib } from './lrclib';
import { createJsonResponse } from '@/src/testing/test-utils';

const base = {
  id: 1,
  trackName: 'Song',
  artistName: 'Artist',
  duration: 180,
  instrumental: false,
  syncedLyrics: '[00:01.00] Hello',
};

afterEach(() => vi.unstubAllGlobals());

describe('LRCLIB accuracy adapter', () => {
  test('rejects same-name live versions and selects exact normalized identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse([
        { ...base, trackName: 'Song (Live)' },
        { ...base, id: 2 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchLyricsFromLrclib(
      { title: 'Song', artists: ['Artist'], durationSeconds: 180 },
      new AbortController().signal,
    );
    expect(result).toMatchObject({ status: 'available', source: 'lrclib' });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit' });
  });

  test('title-only discovery still requires an artist match', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse([]))
        .mockResolvedValueOnce(
          createJsonResponse([{ ...base, artistName: 'Different Artist' }]),
        ),
    );
    await expect(
      fetchLyricsFromLrclib(
        { title: 'Song', artists: ['Artist'] },
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'not-found',
      lines: [],
    });
  });

  test('accepts a five-second duration edge and rejects values beyond it', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse([{ ...base, duration: 185 }]))
        .mockResolvedValueOnce(
          createJsonResponse([{ ...base, duration: 185.1 }]),
        )
        .mockResolvedValueOnce(
          createJsonResponse([{ ...base, duration: 185.1 }]),
        ),
    );
    await expect(
      fetchLyricsFromLrclib(
        { title: 'Song', artists: ['Artist'], durationSeconds: 180 },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ status: 'available' });
    await expect(
      fetchLyricsFromLrclib(
        { title: 'Song', artists: ['Artist'], durationSeconds: 180 },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ status: 'unavailable', reason: 'not-found' });
  });
});
