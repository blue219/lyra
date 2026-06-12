import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchLyricsFromLrclib } from './lrclib';

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
      sourceLanguage: 'ja-JP',
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createJsonResponse([]));

    const result = await fetchLyricsFromLrclib({
      title: 'Missing',
      artists: ['Nobody'],
    });

    expect(result).toEqual({
      status: 'unavailable',
      lines: [],
    });
  });
});

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
