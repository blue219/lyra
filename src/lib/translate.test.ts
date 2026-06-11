import { afterEach, describe, expect, test, vi } from 'vitest';

import { translateLyricLines } from './translate';
import type { LyricLine } from './types';

const simpleLines: LyricLine[] = [
  { timeMs: 1_000, original: 'Hello' },
  { timeMs: 3_000, original: 'World' },
];

describe('translateLyricLines', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns original lines unchanged when the array is empty', async () => {
    const result = await translateLyricLines([], 'en-US', 'ja-JP');

    expect(result).toEqual([]);
  });

  test('returns original lines unchanged when source and target language codes are identical', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await translateLyricLines(simpleLines, 'en-US', 'en-US');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('translates lines via Google Translate and populates translated field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      expect(url).toContain('translate.googleapis.com');
      expect(url).toContain('sl=auto');
      expect(url).toContain('tl=ja');
      expect(url).toContain('dt=t');
      expect(url).toContain('client=gtx');
      expect(decodeURIComponent(url)).toContain('Hello␞World');

      // Google Translate response: [[["translated", "original", ...]], null, "tl"]
      return new Response(
        JSON.stringify([[
          ['こんにちは', 'Hello', null, null, 1],
          ['␞', null, null, null, 0],
          ['世界', 'World', null, null, 1],
        ] as unknown[], null, 'ja']),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const result = await translateLyricLines(simpleLines, undefined, 'ja-JP');

    expect(result).toEqual([
      { timeMs: 1_000, original: 'Hello', translated: 'こんにちは', translatedLanguage: 'ja-JP' },
      { timeMs: 3_000, original: 'World', translated: '世界', translatedLanguage: 'ja-JP' },
    ]);
  });

  test('keeps line mapping when Google Translate collapses newline separators', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([[
          ['こんにちは␞世界', 'Hello␞World', null, null, 1],
        ] as unknown[], null, 'ja']),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await translateLyricLines(simpleLines, 'en-US', 'ja-JP');

    expect(result).toEqual([
      { timeMs: 1_000, original: 'Hello', translated: 'こんにちは', translatedLanguage: 'ja-JP' },
      { timeMs: 3_000, original: 'World', translated: '世界', translatedLanguage: 'ja-JP' },
    ]);
  });

  test('returns original lines when the API response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 429 }),
    );

    const result = await translateLyricLines(simpleLines, 'en-US', 'ja-JP');

    expect(result).toEqual(simpleLines);
  });

  test('returns original lines when line count mismatches after split', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        // Only one translated line instead of two
        JSON.stringify([[
          ['Hello World', 'Hello\nWorld', null, null, 1],
        ] as unknown[], null, 'ja']),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await translateLyricLines(simpleLines, 'en-US', 'ja-JP');

    expect(result).toEqual(simpleLines);
  });

  test('returns original lines on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await translateLyricLines(simpleLines, 'en-US', 'ja-JP');

    expect(result).toEqual(simpleLines);
  });
});
