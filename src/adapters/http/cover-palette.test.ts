import { describe, expect, test, vi } from 'vitest';

import {
  createCoverPaletteResolver,
  isSupportedCoverImageUrl,
} from './cover-palette';

const coverUrl = 'https://i.scdn.co/image/cover';
const pixels = new Uint8ClampedArray([216, 40, 88, 255]);

describe('isSupportedCoverImageUrl', () => {
  test('accepts only HTTPS Spotify image CDN URLs', () => {
    expect(isSupportedCoverImageUrl(coverUrl)).toBe(true);
    expect(isSupportedCoverImageUrl('http://i.scdn.co/image/cover')).toBe(
      false,
    );
    expect(
      isSupportedCoverImageUrl('https://cdn.example.com/image/cover'),
    ).toBe(false);
    expect(isSupportedCoverImageUrl('not a URL')).toBe(false);
  });
});

describe('createCoverPaletteResolver', () => {
  test('downloads a supported image once and caches its derived palette in memory', async () => {
    const fetchImage = vi.fn().mockResolvedValue(
      new Response(new Blob(['image']), {
        headers: { 'content-type': 'image/jpeg' },
        status: 200,
      }),
    );
    const decodePixels = vi.fn().mockResolvedValue(pixels);
    const resolver = createCoverPaletteResolver({ fetchImage, decodePixels });

    await expect(resolver.resolve(coverUrl)).resolves.toEqual([
      '#d6436b',
      '#a41e42',
      '#68132a',
    ]);
    await expect(resolver.resolve(coverUrl)).resolves.toEqual([
      '#d6436b',
      '#a41e42',
      '#68132a',
    ]);
    expect(fetchImage).toHaveBeenCalledOnce();
    expect(decodePixels).toHaveBeenCalledOnce();
  });

  test.each([
    [
      'an unsupported URL',
      'https://example.com/cover.jpg',
      undefined,
      undefined,
    ],
    ['a non-image response', coverUrl, 'text/html', undefined],
    ['an oversized image', coverUrl, 'image/jpeg', String(2 * 1024 * 1024 + 1)],
  ] as const)(
    'returns no palette for %s',
    async (_label, url, contentType, contentLength) => {
      const fetchImage = vi.fn().mockResolvedValue(
        new Response(new Blob(['image']), {
          headers: {
            'content-type': contentType ?? 'image/jpeg',
            ...(contentLength ? { 'content-length': contentLength } : {}),
          },
          status: 200,
        }),
      );
      const decodePixels = vi.fn().mockResolvedValue(pixels);
      const resolver = createCoverPaletteResolver({ fetchImage, decodePixels });

      await expect(resolver.resolve(url)).resolves.toBeNull();
      expect(decodePixels).not.toHaveBeenCalled();
    },
  );

  test('falls back when downloading or decoding fails', async () => {
    const fetchImage = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(
        new Response(new Blob(['image']), {
          headers: { 'content-type': 'image/jpeg' },
          status: 200,
        }),
      );
    const decodePixels = vi.fn().mockRejectedValue(new Error('decode'));
    const resolver = createCoverPaletteResolver({ fetchImage, decodePixels });

    await expect(resolver.resolve(`${coverUrl}-network`)).resolves.toBeNull();
    await expect(resolver.resolve(`${coverUrl}-decode`)).resolves.toBeNull();
  });

  test('aborts and falls back after the eight-second download deadline', async () => {
    vi.useFakeTimers();
    const fetchImage = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          (init?.signal as AbortSignal).addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const resolver = createCoverPaletteResolver({ fetchImage });
    const result = resolver.resolve(`${coverUrl}-timeout`);

    await vi.advanceTimersByTimeAsync(8_000);
    await expect(result).resolves.toBeNull();
    vi.useRealTimers();
  });

  test('rejects a downloaded image that exceeds the size limit', async () => {
    const largeImage = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)]);
    const fetchImage = vi.fn().mockResolvedValue(
      new Response(largeImage, {
        headers: { 'content-type': 'image/jpeg' },
        status: 200,
      }),
    );
    const decodePixels = vi.fn().mockResolvedValue(pixels);
    const resolver = createCoverPaletteResolver({ fetchImage, decodePixels });

    await expect(resolver.resolve(`${coverUrl}-large`)).resolves.toBeNull();
    expect(decodePixels).not.toHaveBeenCalled();
  });
});
