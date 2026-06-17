import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchLyricsFromLrclib } from './lrclib';
import { createJsonResponse } from '../../shared/test-utils';

describe('fetchLyricsFromLrclib', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns original synced lyrics from the best LRCLIB search match', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);

        expect(init?.headers).toMatchObject({
          Accept: 'application/json',
          'X-User-Agent': 'Lyra 0.1.0',
          'Lrclib-Client': 'Lyra 0.1.0',
        });

        if (url.includes('/api/search?track_name=Home+Sweet+Home&artist_name=YUKI')) {
          return createJsonResponse([
            {
              id: 10989117,
              trackName: 'Home Sweet Home',
              artistName: 'YUKI',
              albumName: 'Home Sweet Home',
              duration: 287,
              instrumental: false,
              plainLyrics: '...',
              syncedLyrics: '[00:00.19] 歩きつかれて ふりだす雨\n[00:05.20] つまらないまま 歩いてる',
            },
          ]);
        }

        return createJsonResponse([], 404);
      });

    const result = await fetchLyricsFromLrclib({
      title: 'Home Sweet Home',
      artists: ['YUKI'],
      album: 'Home Sweet Home',
      durationSeconds: 287,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'monolingual',
      source: 'lrclib',
      lines: [
        { timeMs: 190, original: '歩きつかれて ふりだす雨' },
        { timeMs: 5_200, original: 'つまらないまま 歩いてる' },
      ],
    });
  });

  test('treats embedded bilingual LRCLIB text as original text only', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createJsonResponse([
        {
          id: 30000000,
          trackName: 'Hello',
          artistName: 'Singer',
          albumName: 'Album',
          duration: 180,
          instrumental: false,
          plainLyrics: '...',
          syncedLyrics: '[00:01.00] Hello / 你好',
        },
      ]),
    );

    const result = await fetchLyricsFromLrclib({
      title: 'Hello',
      artists: ['Singer'],
    });

    expect(result.lines[0]).toEqual({
      timeMs: 1_000,
      original: 'Hello / 你好',
    });
  });

  test('falls back to track-only search when artist-constrained search has no matches', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('/api/search?track_name=Drama&artist_name=Unknown')) {
          return createJsonResponse([]);
        }

        if (url.includes('/api/search?track_name=Drama') && !url.includes('artist_name=')) {
          return createJsonResponse([
            {
              id: 222222,
              trackName: 'Drama',
              artistName: 'YUKI',
              albumName: 'Drama',
              duration: 260,
              instrumental: false,
              plainLyrics: '...',
              syncedLyrics: '[00:01.00] 失くした約束は星に',
            },
          ]);
        }

        return createJsonResponse([], 404);
      });

    const result = await fetchLyricsFromLrclib({
      title: 'Drama',
      artists: ['Unknown'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('monolingual');
    expect(result.source).toBe('lrclib');
    expect(result.lines[0]?.original).toBe('失くした約束は星に');
  });

  test('returns unavailable when no synced lyrics are found', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => createJsonResponse([]));

    const result = await fetchLyricsFromLrclib({
      title: 'Missing',
      artists: ['Nobody'],
    });

    expect(result).toEqual({
      status: 'unavailable',
      unavailableReason: 'not-found',
      lines: [],
    });
  });

  test('retries the artist search after a transient 503 response', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 10989117,
            trackName: 'Home Sweet Home',
            artistName: 'YUKI',
            albumName: 'Home Sweet Home',
            duration: 287,
            instrumental: false,
            plainLyrics: '...',
            syncedLyrics: '[00:00.19] 歩きつかれて ふりだす雨',
          },
        ]),
      );

    const result = await fetchLyricsFromLrclib({
      title: 'Home Sweet Home',
      artists: ['YUKI'],
      album: 'Home Sweet Home',
      durationSeconds: 287,
    });

    expect(result.status).toBe('monolingual');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('continues to track-only search when artist search transient failures exhaust retries', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 222222,
            trackName: 'Drama',
            artistName: 'YUKI',
            albumName: 'Drama',
            duration: 260,
            instrumental: false,
            plainLyrics: '...',
            syncedLyrics: '[00:01.00] 失くした約束は星に',
          },
        ]),
      );

    const result = await fetchLyricsFromLrclib({
      title: 'Drama',
      artists: ['Unknown'],
    });

    expect(result.status).toBe('monolingual');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('retries the track-only search after a transient network error', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 222222,
            trackName: 'Drama',
            artistName: 'YUKI',
            albumName: 'Drama',
            duration: 260,
            instrumental: false,
            plainLyrics: '...',
            syncedLyrics: '[00:01.00] 失くした約束は星に',
          },
        ]),
      );

    const result = await fetchLyricsFromLrclib({
      title: 'Drama',
      artists: ['Unknown'],
    });

    expect(result.status).toBe('monolingual');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('does not retry on a 404 response', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));

    const result = await fetchLyricsFromLrclib({
      title: 'Missing',
      artists: ['Nobody'],
    });

    expect(result).toEqual({
      status: 'unavailable',
      unavailableReason: 'provider-error',
      lines: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('returns rate-limited after track-only 429 failures exhaust retries', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }));

    const result = await fetchLyricsFromLrclib({
      title: 'Missing',
      artists: ['Nobody'],
    });

    expect(result).toEqual({
      status: 'unavailable',
      unavailableReason: 'rate-limited',
      lines: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('returns network-error after track-only network failures exhaust retries', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockRejectedValueOnce(new TypeError('network down'));

    const result = await fetchLyricsFromLrclib({
      title: 'Missing',
      artists: ['Nobody'],
    });

    expect(result).toEqual({
      status: 'unavailable',
      unavailableReason: 'network-error',
      lines: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
