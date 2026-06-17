import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { translateLyricLines, translateLyricsResult } from './translate';
import type { LyricLine } from '../../shared/types';
import { createJsonResponse } from '../../shared/test-utils';

const simpleLines: LyricLine[] = [
  { timeMs: 1_000, original: 'Hello' },
  { timeMs: 3_000, original: 'World' },
];

const googleLineSeparator = '[[LYRA_LINE_BREAK_8B4B4F0D]]';

describe('translateLyricLines', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_LIBRETRANSLATE_BASE_URL', 'http://translate.test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test('translates lyrics with Google before calling LibreTranslate', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      expect(url.origin).toBe('https://translate.googleapis.com');
      expect(url.pathname).toBe('/translate_a/single');
      expect(url.searchParams.get('client')).toBe('gtx');
      expect(url.searchParams.get('sl')).toBe('auto');
      expect(url.searchParams.get('tl')).toBe('zh-CN');
      expect(url.searchParams.get('dt')).toBe('t');
      expect(url.searchParams.get('q')).toBe(
        `Hello\n${googleLineSeparator}\nWorld`,
      );

      return createGoogleTranslateResponse([
        '你好\n',
        `${googleLineSeparator}\n`,
        '世界',
      ]);
    });

    const result = await translateLyricLines(simpleLines, 'zh-CN');

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('returns original lines when Google detects the same source and target language', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createGoogleTranslateResponse(['你好世界'], 'zh-CN'),
    );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('splits Google requests on lyric line boundaries when the query would be too long', async () => {
    const lines: LyricLine[] = [
      { timeMs: 1_000, original: 'First '.repeat(250) },
      { timeMs: 2_000, original: 'Second '.repeat(100) },
      { timeMs: 3_000, original: 'Third '.repeat(100) },
    ];

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const query = url.searchParams.get('q');

      if (query === lines[0]?.original) {
        return createGoogleTranslateResponse(['第一']);
      }

      expect(query).toBe(`${lines[1]?.original}\n${googleLineSeparator}\n${lines[2]?.original}`);
      return createGoogleTranslateResponse([
        '第二\n',
        `${googleLineSeparator}\n`,
        '第三',
      ]);
    });

    const result = await translateLyricLines(lines, 'zh-CN');

    expect(result.map((line) => line.translated)).toEqual(['第一', '第二', '第三']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('falls back only for a Google chunk that cannot preserve lyric line count', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const lines: LyricLine[] = [
      { timeMs: 1_000, original: 'First '.repeat(250) },
      { timeMs: 2_000, original: 'Second '.repeat(100) },
      { timeMs: 3_000, original: 'Third '.repeat(100) },
    ];

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (isGoogleTranslateUrl(input)) {
        const query = new URL(String(input)).searchParams.get('q');

        if (query === lines[0]?.original) {
          return createGoogleTranslateResponse(['第一']);
        }

        return createGoogleTranslateResponse(['第二第三']);
      }

      expect(String(input)).toBe('http://translate.test/translate');
      expect(JSON.parse(String(init?.body))).toEqual({
        q: `${lines[1]?.original}\n${lines[2]?.original}`,
        source: 'en',
        target: 'zh-Hans',
        format: 'text',
        api_key: 'test-key',
      });

      return createJsonResponse({
        translatedText: '第二\n第三',
      });
    });

    const result = await translateLyricLines(lines, 'zh-CN');

    expect(result.map((line) => line.translated)).toEqual(['第一', '第二', '第三']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('falls back for a single lyric line that is longer than the Google query limit', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const lines: LyricLine[] = [
      { timeMs: 1_000, original: 'short line' },
      { timeMs: 2_000, original: 'very long line '.repeat(140) },
    ];

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (isGoogleTranslateUrl(input)) {
        expect(new URL(String(input)).searchParams.get('q')).toBe(lines[0]?.original);
        return createGoogleTranslateResponse(['短句']);
      }

      expect(String(input)).toBe('http://translate.test/translate');
      expect(JSON.parse(String(init?.body))).toEqual({
        q: lines[1]?.original,
        source: 'en',
        target: 'zh-Hans',
        format: 'text',
        api_key: 'test-key',
      });

      return createJsonResponse({
        translatedText: '很长的一行',
      });
    });

    const result = await translateLyricLines(lines, 'zh-CN');

    expect(result.map((line) => line.translated)).toEqual(['短句', '很长的一行']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('falls back to LibreTranslate after Google returns an invalid response', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_BASE_URL', 'http://translate.test');
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (isGoogleTranslateUrl(input)) {
        return createJsonResponse({});
      }

      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });

      if (String(input) === 'http://translate.test/detect') {
        expect(JSON.parse(String(init?.body))).toEqual({
          q: 'Hello\nWorld',
          api_key: 'test-key',
        });

        return createJsonResponse({
          confidence: 90,
          language: 'en',
        });
      }

      expect(String(input)).toBe('http://translate.test/translate');
      expect(JSON.parse(String(init?.body))).toEqual({
        q: 'Hello\nWorld',
        source: 'en',
        target: 'zh-Hans',
        format: 'text',
        api_key: 'test-key',
      });

      return createJsonResponse({
        translatedText: '你好\n世界',
      });
    });

    const result = await translateLyricLines(simpleLines, 'zh-CN');

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
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('falls back to LibreTranslate after Google cannot preserve lyric line count', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (isGoogleTranslateUrl(input)) {
        return createGoogleTranslateResponse(['你好世界']);
      }

      if (String(input) === 'http://translate.test/detect') {
        return createJsonResponse({
          confidence: 90,
          language: 'en',
        });
      }

      return createJsonResponse({
        translatedText: '你好\n世界',
      });
    });

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result[0]?.translated).toBe('你好');
    expect(result[1]?.translated).toBe('世界');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('falls back to LibreTranslate after Google request failures', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          translatedText: '你好\n世界',
        }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result[0]?.translated).toBe('你好');
    expect(result[1]?.translated).toBe('世界');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('accepts LibreTranslate detect responses returned as an array', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            confidence: 71,
            language: 'en',
          },
        ]),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          translatedText: '你好\n世界',
        }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

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

  test('strips ASS style override tags from translated lyrics', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            confidence: 71,
            language: 'en',
          },
        ]),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          translatedText:
            '你好\n{\\fn黑体\\fs22\\bord1\\shad0\\3aHBE\\4aH00\\fscx67\\fscy66\\2cHFFFFFF\\3cH808080}世界',
        }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

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

  test('keeps musical marker translations as the original marker', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createGoogleTranslateResponse(['你好\n', `${googleLineSeparator}\n`, '? 吗?']),
    );

    const result = await translateLyricLines(
      [
        { timeMs: 1_000, original: 'Hello' },
        { timeMs: 3_000, original: '♪' },
      ],
      'zh-CN',
    );

    expect(result).toEqual([
      {
        timeMs: 1_000,
        original: 'Hello',
        translated: '你好',
        translatedLanguage: 'zh-CN',
      },
      {
        timeMs: 3_000,
        original: '♪',
        translated: '♪',
        translatedLanguage: 'zh-CN',
      },
    ]);
  });

  test('returns original lines unchanged when detected source and target are the same', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
      createJsonResponse({
        confidence: 90,
        language: 'zh-Hans',
      }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('http://translate.test/detect');
  });

  test('returns original lines when the base URL is missing', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_BASE_URL', '');
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isGoogleTranslateUrl(fetchMock.mock.calls[0]?.[0])).toBe(true);
  });

  test('returns original lines when the API key is missing', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', '');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isGoogleTranslateUrl(fetchMock.mock.calls[0]?.[0])).toBe(true);
  });

  test('returns original lines when language detection fails', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValue(new Response('', { status: 429 }));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
  });

  test('retries language detection after a transient 429 response', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          translatedText: '你好\n世界',
        }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result[0]?.translated).toBe('你好');
    expect(result[1]?.translated).toBe('世界');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('retries translation after a transient 503 response', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          translatedText: '你好\n世界',
        }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result[0]?.translated).toBe('你好');
    expect(result[1]?.translated).toBe('世界');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('retries translation after a transient network failure', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(
        createJsonResponse({
          translatedText: '你好\n世界',
        }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result[0]?.translated).toBe('你好');
    expect(result[1]?.translated).toBe('世界');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('returns original lines when language detection returns an unsupported language', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
      createJsonResponse({
        confidence: 90,
        language: 'ja',
      }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
  });

  test('returns original lines when the translation response is a non-retryable 400', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 400 }));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
  });

  test('returns original lines after translation transient failures exhaust retries', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test('does not retry translation on a 400 response', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 400 }));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('returns original lines when the translation response format is invalid', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockResolvedValueOnce(createJsonResponse({}));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
  });

  test('returns original lines when the translated line count mismatches', async () => {
    vi.stubEnv('VITE_LIBRETRANSLATE_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          confidence: 90,
          language: 'en',
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          translatedText: '你好世界',
        }),
      );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
  });

  test('populates source language on translated lyrics results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createGoogleTranslateResponse([
        '你好\n',
        `${googleLineSeparator}\n`,
        '世界',
      ]),
    );

    const result = await translateLyricsResult(
      {
        status: 'monolingual',
        lines: simpleLines,
        source: 'spotify',
      },
      'zh-CN',
    );

    expect(result).toEqual({
      status: 'bilingual',
      lines: [
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
      ],
      source: 'spotify',
      sourceLanguage: 'en-US',
    });
  });
});

function createGoogleTranslateResponse(
  translatedSegments: string[],
  detectedLanguage = 'en',
): Response {
  return createJsonResponse([
    translatedSegments.map((segment) => [segment, '', null, null, 10]),
    null,
    detectedLanguage,
  ]);
}

function isGoogleTranslateUrl(input: unknown): boolean {
  return String(input).startsWith('https://translate.googleapis.com/translate_a/single?');
}
