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
    vi.unstubAllEnvs();
  });

  test('posts batched lyrics to LibreTranslate and populates translated fields', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_BASE_URL', 'http://translate.test');
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(String(input)).toBe('http://translate.test/translate');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(String(init?.body))).toEqual({
        q: 'Hello␞World',
        source: 'en',
        target: 'zh-Hans',
        format: 'text',
        api_key: 'test-key',
      });

      return createJsonResponse({
        translatedText: '你好␞世界',
      });
    });

    const result = await translateLyricLines(simpleLines, 'en-US', 'zh-CN');

    expect(result).toEqual([
      {
        timeMs: 1_000,
        original: 'Hello',
        translated: '你好',
        translatedLanguage: 'zh-CN',
      },
      {
        timeMs: 3_000,
        original: 'World',
        translated: '世界',
        translatedLanguage: 'zh-CN',
      },
    ]);
  });

  test('returns original lines unchanged when the source and target are the same', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await translateLyricLines(simpleLines, 'en-US', 'en-US');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns original lines when the API key is missing', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', '');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await translateLyricLines(simpleLines, 'en-US', 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns original lines when the API response is not ok', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429 }));

    const result = await translateLyricLines(simpleLines, 'en-US', 'zh-CN');

    expect(result).toEqual(simpleLines);
  });

  test('returns original lines when the response format is invalid', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createJsonResponse({}));

    const result = await translateLyricLines(simpleLines, 'en-US', 'zh-CN');

    expect(result).toEqual(simpleLines);
  });

  test('returns original lines when the translated line count mismatches', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createJsonResponse({
        translatedText: '你好世界',
      }),
    );

    const result = await translateLyricLines(simpleLines, 'en-US', 'zh-CN');

    expect(result).toEqual(simpleLines);
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
