import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchLyricsFromLrclib } from './lrclib';

describe('fetchLyricsFromLrclib', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('falls back to track-only search when artist-constrained lookup returns no LRCLIB matches', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('/api/search?track_name=Home+Sweet+Home&artist_name=Neko+Hacker')) {
          return createJsonResponse([]);
        }

        if (url.includes('/api/search?track_name=Home+Sweet+Home') && !url.includes('artist_name=')) {
          return createJsonResponse([
            {
              id: 944051,
              trackName: 'Home Sweet Home (feat. KMNZ LIZ)',
              artistName: 'Neko Hacker',
              albumName: 'Neko Hacker',
              duration: 230,
              instrumental: false,
              plainLyrics: '...',
              syncedLyrics: '[00:15.83] 1日ゴロゴロパソコン開いて',
            },
          ]);
        }

        return createJsonResponse([], 404);
      });

    const result = await fetchLyricsFromLrclib({
      title: 'Home Sweet Home',
      artists: ['Neko Hacker'],
      album: 'Neko Hacker',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('monolingual');
    expect(result.lines[0]?.original).toBe('1日ゴロゴロパソコン開いて');
  });

  test('uses the official cached signature lookup when album and duration are available', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);

        expect(init?.headers).toMatchObject({
          Accept: 'application/json',
          'X-User-Agent': 'Lyra 0.1.0',
          'Lrclib-Client': 'Lyra 0.1.0',
        });

        if (
          url.includes('/api/get?') &&
          url.includes('track_name=Home+Sweet+Home') &&
          url.includes('artist_name=Neko+Hacker') &&
          url.includes('album_name=Neko+Hacker') &&
          url.includes('duration=229')
        ) {
          return createJsonResponse({
            id: 12117015,
            trackName: 'Home Sweet Home',
            artistName: 'Neko Hacker',
            albumName: 'Neko Hacker',
            duration: 229,
            instrumental: false,
            plainLyrics: '...',
            syncedLyrics: '[00:15.85] 1日ゴロゴロパソコン開いて',
          });
        }

        return createJsonResponse([], 404);
      });

    const result = await fetchLyricsFromLrclib({
      title: 'Home Sweet Home',
      artists: ['Neko Hacker'],
      album: 'Neko Hacker',
      durationSeconds: 229,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('monolingual');
    expect(result.lines[0]?.original).toBe('1日ゴロゴロパソコン開いて');
  });

  test('prefers a search result with the requested translation language over a monolingual signature match', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('/api/get?')) {
          return createJsonResponse({
            id: 10989117,
            trackName: 'Home Sweet Home',
            artistName: 'YUKI',
            albumName: 'Home Sweet Home',
            duration: 287,
            instrumental: false,
            plainLyrics: '...',
            syncedLyrics: '[00:00.19] 歩きつかれて ふりだす雨',
          });
        }

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
              syncedLyrics: '[00:00.19] 歩きつかれて ふりだす雨',
            },
            {
              id: 30000000,
              trackName: 'Home Sweet Home',
              artistName: 'YUKI',
              albumName: 'Home Sweet Home',
              duration: 287,
              instrumental: false,
              plainLyrics: '...',
              syncedLyrics: '[00:00.19] 歩きつかれて ふりだす雨 / Tired from walking, the rain begins',
            },
          ]);
        }

        return createJsonResponse([], 404);
      });

    const result = await fetchLyricsFromLrclib(
      {
        title: 'Home Sweet Home',
        artists: ['YUKI'],
        album: 'Home Sweet Home',
        durationSeconds: 287,
      },
      'en-US',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('bilingual');
    expect(result.lines[0]?.translated).toBe('Tired from walking, the rain begins');
  });
  test('translates a monolingual match when target language differs from source', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('/api/get?')) {
          return createJsonResponse({
            id: 10989117,
            trackName: 'Home Sweet Home',
            artistName: 'YUKI',
            albumName: 'Home Sweet Home',
            duration: 287,
            instrumental: false,
            plainLyrics: '...',
            syncedLyrics: '[00:00.19] 歩きつかれて ふりだす雨\n[00:05.20] つまらないまま 歩いてる',
          });
        }

        if (url.includes('/api/search?track_name=Home+Sweet+Home&artist_name=YUKI')) {
          return createJsonResponse([], 404);
        }

        if (url.includes('translate.googleapis.com')) {
          return createJsonResponse([[
            ['Tired of walking, the pouring rain␞', '歩きつかれて ふりだす雨␞', null, null, 3],
            ['Still walking without stopping', 'つまらないまま 歩いてる', null, null, 3],
          ] as unknown[], null, 'en']);
        }

        return createJsonResponse([], 404);
      });

    const result = await fetchLyricsFromLrclib(
      { title: 'Home Sweet Home', artists: ['YUKI'], album: 'Home Sweet Home', durationSeconds: 287 },
      'en-US',
    );

    expect(result.status).toBe('bilingual');
    expect(result.lines[0]?.translated).toBe('Tired of walking, the pouring rain');
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
