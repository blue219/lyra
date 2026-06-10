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

        if (url.includes('/api/get?')) {
          return createJsonResponse({}, 404);
        }

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
});

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
