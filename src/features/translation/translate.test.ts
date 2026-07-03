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
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('translates lyrics with Google Translate', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
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

  test('maps additional target languages for Google Translate', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      expect(url.searchParams.get('tl')).toBe('ja');

      return createGoogleTranslateResponse([
        'こんにちは\n',
        `${googleLineSeparator}\n`,
        '世界',
      ]);
    });

    const result = await translateLyricLines(simpleLines, 'ja-JP');

    expect(result.map((line) => line.translated)).toEqual(['こんにちは', '世界']);
    expect(result.every((line) => line.translatedLanguage === 'ja-JP')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('maps traditional Chinese for Google Translate', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      expect(url.searchParams.get('tl')).toBe('zh-TW');

      return createGoogleTranslateResponse([
        '你好\n',
        `${googleLineSeparator}\n`,
        '世界',
      ]);
    });

    const result = await translateLyricLines(simpleLines, 'zh-TW');

    expect(result.map((line) => line.translated)).toEqual(['你好', '世界']);
    expect(result.every((line) => line.translatedLanguage === 'zh-TW')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('omits provider translations that match the original lyric text', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      createGoogleTranslateResponse([
        '蜻蜓落在露水旁乘凉\n',
        `${googleLineSeparator}\n`,
        '世界',
      ]),
    );

    const result = await translateLyricLines(
      [
        { timeMs: 1_000, original: '蜻蜓落在露水旁乘凉' },
        { timeMs: 3_000, original: 'World' },
      ],
      'zh-CN',
    );

    expect(result).toEqual([
      { timeMs: 1_000, original: '蜻蜓落在露水旁乘凉' },
      {
        timeMs: 3_000,
        original: 'World',
        translated: '世界',
        translatedLanguage: 'zh-CN',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('keeps lyrics monolingual when every provider translation matches the original text', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      createGoogleTranslateResponse([
        '蜻蜓落在露水旁乘凉\n',
        `${googleLineSeparator}\n`,
        '露水凉',
      ]),
    );

    const result = await translateLyricsResult(
      {
        status: 'monolingual',
        source: 'spotify',
        lines: [
          { timeMs: 1_000, original: '蜻蜓落在露水旁乘凉' },
          { timeMs: 3_000, original: '露水凉' },
        ],
      },
      'zh-CN',
    );

    expect(result).toEqual({
      status: 'monolingual',
      source: 'spotify',
      sourceLanguage: 'en-US',
      translationSkippedReason: 'same-text',
      lines: [
        { timeMs: 1_000, original: '蜻蜓落在露水旁乘凉' },
        { timeMs: 3_000, original: '露水凉' },
      ],
    });
  });

  test('falls back to Microsoft Translator web when Google is rate limited', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.origin === 'https://translate.googleapis.com') {
        return createJsonResponse({ error: 'rate limited' }, 429);
      }

      if (url.href === 'https://translator.bing.com/') {
        return createBingTranslatorPageResponse('MICROSOFT_IG', 'microsoft-token', 12345);
      }

      return createMicrosoftTranslatorResponse(
        `你好\n${googleLineSeparator}\n世界`,
      );
    });

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result.map((line) => line.translated)).toEqual(['你好', '世界']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const microsoftRequest = fetchMock.mock.calls[2];
    const microsoftUrl = new URL(String(microsoftRequest?.[0]));
    const microsoftBody = new URLSearchParams(String(microsoftRequest?.[1]?.body));

    expect(microsoftUrl.origin).toBe('https://translator.bing.com');
    expect(microsoftUrl.pathname).toBe('/ttranslatev3');
    expect(microsoftUrl.searchParams.get('isVertical')).toBe('1');
    expect(microsoftUrl.searchParams.get('IG')).toBe('MICROSOFT_IG');
    expect(microsoftUrl.searchParams.get('IID')).toBe('translator.5028');
    expect(microsoftBody.get('fromLang')).toBe('auto-detect');
    expect(microsoftBody.get('to')).toBe('zh-Hans');
    expect(microsoftBody.get('text')).toBe(`Hello\n${googleLineSeparator}\nWorld`);
    expect(microsoftBody.get('token')).toBe('microsoft-token');
    expect(microsoftBody.get('key')).toBe('12345');
  });

  test('maps traditional Chinese for Microsoft Translator web', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.origin === 'https://translate.googleapis.com') {
        return createJsonResponse({ error: 'rate limited' }, 429);
      }

      if (url.href === 'https://translator.bing.com/') {
        return createBingTranslatorPageResponse('MICROSOFT_IG', 'microsoft-token', 12345);
      }

      return createMicrosoftTranslatorResponse(
        `你好\n${googleLineSeparator}\n世界`,
      );
    });

    const result = await translateLyricLines(simpleLines, 'zh-TW');
    const microsoftRequest = fetchMock.mock.calls[2];
    const microsoftBody = new URLSearchParams(String(microsoftRequest?.[1]?.body));

    expect(result.map((line) => line.translated)).toEqual(['你好', '世界']);
    expect(microsoftBody.get('to')).toBe('zh-Hant');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('falls back to Microsoft Translator web when Google has a network error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.origin === 'https://translate.googleapis.com') {
        throw new TypeError('network down');
      }

      if (url.href === 'https://translator.bing.com/') {
        return createBingTranslatorPageResponse('MICROSOFT_IG', 'microsoft-token', 12345);
      }

      return createMicrosoftTranslatorResponse(
        `你好\n${googleLineSeparator}\n世界`,
      );
    });

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result.map((line) => line.translated)).toEqual(['你好', '世界']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('returns original lines when Google detects the same source and target language', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createGoogleTranslateResponse(['你好世界'], 'zh-CN'),
    );

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('falls back when Google reports a matching added language without usable lyric lines', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createGoogleTranslateResponse(['こんにちは世界'], 'ja'),
    );

    const result = await translateLyricsResult(
      {
        status: 'monolingual',
        lines: simpleLines,
        source: 'spotify',
      },
      'ja-JP',
    );

    expect(result).toEqual({
      status: 'monolingual',
      lines: simpleLines,
      source: 'spotify',
      sourceLanguage: undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('keeps English translations when Google misdetects the source language as English', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createGoogleTranslateResponse([
        'Leaning on a branch\n',
        `${googleLineSeparator}\n`,
        'Dragonfly rests on the dew to enjoy the coolness',
      ], 'en'),
    );

    const result = await translateLyricsResult(
      {
        status: 'monolingual',
        lines: [
          { timeMs: 1_000, original: '背靠在樹枝上' },
          { timeMs: 2_000, original: '蜻蜓落在露水旁乘涼' },
        ],
        source: 'spotify',
      },
      'en-US',
    );

    expect(result).toEqual({
      status: 'bilingual',
      lines: [
        {
          timeMs: 1_000,
          original: '背靠在樹枝上',
          translated: 'Leaning on a branch',
          translatedLanguage: 'en-US',
        },
        {
          timeMs: 2_000,
          original: '蜻蜓落在露水旁乘涼',
          translated: 'Dragonfly rests on the dew to enjoy the coolness',
          translatedLanguage: 'en-US',
        },
      ],
      source: 'spotify',
      sourceLanguage: 'en-US',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('keeps translating other chunks when one Google chunk is misdetected as the target language', async () => {
    const lines: LyricLine[] = [
      { timeMs: 1_000, original: 'A'.repeat(1_790) },
      { timeMs: 2_000, original: '第二段歌词' },
      { timeMs: 3_000, original: '第三段歌词' },
    ];

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const query = url.searchParams.get('q');

      if (query === lines[0]?.original) {
        return createGoogleTranslateResponse(['Already English'], 'en');
      }

      expect(query).toBe(`${lines[1]?.original}\n${googleLineSeparator}\n${lines[2]?.original}`);

      return createGoogleTranslateResponse([
        'Second verse\n',
        `${googleLineSeparator}\n`,
        'Third verse',
      ], 'zh-CN');
    });

    const result = await translateLyricsResult(
      {
        status: 'monolingual',
        lines,
        source: 'spotify',
      },
      'en-US',
    );

    expect(result).toEqual({
      status: 'bilingual',
      lines: [
        {
          timeMs: 1_000,
          original: lines[0]!.original,
          translated: 'Already English',
          translatedLanguage: 'en-US',
        },
        {
          timeMs: 2_000,
          original: '第二段歌词',
          translated: 'Second verse',
          translatedLanguage: 'en-US',
        },
        {
          timeMs: 3_000,
          original: '第三段歌词',
          translated: 'Third verse',
          translatedLanguage: 'en-US',
        },
      ],
      source: 'spotify',
      sourceLanguage: 'en-US',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('skips provider requests when the existing source language matches the target language', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Provider should not be called for same-language lyrics'),
    );

    const result = await translateLyricsResult(
      {
        status: 'monolingual',
        lines: simpleLines,
        source: 'spotify',
        sourceLanguage: 'ja-JP',
      },
      'ja-JP',
    );

    expect(result).toEqual({
      status: 'monolingual',
      lines: simpleLines,
      source: 'spotify',
      sourceLanguage: 'ja-JP',
      translationSkippedReason: 'same-language',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('skips provider requests when the existing source language is a target language alias', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Provider should not be called for same-language aliases'),
    );

    const result = await translateLyricsResult(
      {
        status: 'monolingual',
        lines: simpleLines,
        source: 'spotify',
        sourceLanguage: 'zh-Hans',
      },
      'zh-CN',
    );

    expect(result).toEqual({
      status: 'monolingual',
      lines: simpleLines,
      source: 'spotify',
      sourceLanguage: 'zh-Hans',
      translationSkippedReason: 'same-language',
    });
    expect(fetchMock).not.toHaveBeenCalled();
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

  test('sends only the failed Google chunk to Microsoft while preserving translated chunks', async () => {
    const lines: LyricLine[] = [
      { timeMs: 1_000, original: 'First '.repeat(250) },
      { timeMs: 2_000, original: 'Second '.repeat(100) },
      { timeMs: 3_000, original: 'Third '.repeat(100) },
    ];

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const query = url.searchParams.get('q');

      if (url.origin === 'https://translate.googleapis.com' && query === lines[0]?.original) {
        return createGoogleTranslateResponse(['第一']);
      }

      if (url.origin === 'https://translate.googleapis.com') {
        return createGoogleTranslateResponse(['第二第三']);
      }

      if (url.href === 'https://translator.bing.com/') {
        return createBingTranslatorPageResponse('MICROSOFT_IG', 'microsoft-token', 12345);
      }

      return createMicrosoftTranslatorResponse(
        `第二\n${googleLineSeparator}\n第三`,
      );
    });

    const result = await translateLyricLines(lines, 'zh-CN');

    expect(result.map((line) => line.translated)).toEqual(['第一', '第二', '第三']);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const microsoftRequest = fetchMock.mock.calls[3];
    const microsoftBody = new URLSearchParams(String(microsoftRequest?.[1]?.body));

    expect(microsoftBody.get('text')).toBe(
      `${lines[1]?.original}\n${googleLineSeparator}\n${lines[2]?.original}`,
    );
    expect(warnSpy.mock.calls.flat()).toContainEqual(
      expect.stringContaining('Google Translate chunk failed'),
    );
  });

  test('does not send an over-limit single lyric line to another provider', async () => {
    const lines: LyricLine[] = [
      { timeMs: 1_000, original: 'short line' },
      { timeMs: 2_000, original: 'very long line '.repeat(140) },
    ];

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      expect(new URL(String(input)).searchParams.get('q')).toBe(lines[0]?.original);
      return createGoogleTranslateResponse(['短句']);
    });

    const result = await translateLyricLines(lines, 'zh-CN');

    expect(result).toEqual([
      {
        timeMs: 1_000,
        original: 'short line',
        translated: '短句',
        translatedLanguage: 'zh-CN',
      },
      lines[1],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls).toHaveLength(0);
  });

  test('returns original lines when Google returns an invalid response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(createJsonResponse({}));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(warnSpy.mock.calls.flat()).toContainEqual(
      expect.stringContaining('Google Translate chunk failed'),
    );
  });

  test('returns original lines when Google cannot preserve lyric line count', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createGoogleTranslateResponse(['你好世界']));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(warnSpy.mock.calls.flat()).toContainEqual(
      expect.stringContaining('Google Translate chunk failed'),
    );
  });

  test('returns original lines when the Google request fails', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('network down'));

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(warnSpy.mock.calls.flat()).toContainEqual(
      expect.stringContaining('Google Translate chunk failed'),
    );
  });

  test('falls back to Bing Translator web when Microsoft Translator web fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.origin === 'https://translate.googleapis.com') {
        return createJsonResponse({ error: 'rate limited' }, 429);
      }

      if (url.href === 'https://translator.bing.com/') {
        return createBingTranslatorPageResponse('MICROSOFT_IG', 'microsoft-token', 12345);
      }

      if (url.origin === 'https://translator.bing.com') {
        return createJsonResponse({ ShowCaptcha: false }, 429);
      }

      if (url.href === 'https://www.bing.com/translator') {
        return createBingTranslatorPageResponse('BING_IG', 'bing-token', 67890);
      }

      expect(url.origin).toBe('https://www.bing.com');
      expect(url.pathname).toBe('/ttranslatev3');
      expect(url.searchParams.get('IG')).toBe('BING_IG');

      return createMicrosoftTranslatorResponse(
        `你好\n${googleLineSeparator}\n世界`,
      );
    });

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result.map((line) => line.translated)).toEqual(['你好', '世界']);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test('returns original lines when Microsoft and Bing session parsing fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.origin === 'https://translate.googleapis.com') {
        return createJsonResponse({ error: 'rate limited' }, 429);
      }

      return new Response('<html>No session values</html>', {
        headers: { 'Content-Type': 'text/html' },
      });
    });

    const result = await translateLyricLines(simpleLines, 'zh-CN');

    expect(result).toEqual(simpleLines);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('keeps translations when Microsoft misdetects the source language as the target language', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.origin === 'https://translate.googleapis.com') {
        return createJsonResponse({ error: 'rate limited' }, 429);
      }

      if (url.href === 'https://translator.bing.com/') {
        return createBingTranslatorPageResponse('MICROSOFT_IG', 'microsoft-token', 12345);
      }

      return createMicrosoftTranslatorResponse(
        `你好\n${googleLineSeparator}\n世界`,
        'zh-Hans',
      );
    });

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
      sourceLanguage: 'zh-CN',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('strips ASS style override tags from translated lyrics', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createGoogleTranslateResponse([
        '你好\n',
        `${googleLineSeparator}\n`,
        '{\\fn黑体\\fs22\\bord1\\shad0\\3aHBE\\4aH00\\fscx67\\fscy66\\2cHFFFFFF\\3cH808080}世界',
      ]),
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
      },
    ]);
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

  test('keeps translated lyrics results monolingual when every Google chunk fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createJsonResponse({}));

    const result = await translateLyricsResult(
      {
        status: 'monolingual',
        lines: simpleLines,
        source: 'spotify',
      },
      'zh-CN',
    );

    expect(result).toEqual({
      status: 'monolingual',
      lines: simpleLines,
      source: 'spotify',
      sourceLanguage: undefined,
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

function createBingTranslatorPageResponse(
  ig: string,
  token: string,
  key: number,
): Response {
  return new Response(
    [
      `_G={IG:"${ig}"};`,
      `var params_AbusePreventionHelper = [${key},"${token}",3600000];`,
      `var params_RichTranslate = ["/ttranslatev3?isVertical=1\\u0026"];`,
    ].join(' '),
    {
      headers: {
        'Content-Type': 'text/html',
      },
    },
  );
}

function createMicrosoftTranslatorResponse(
  translatedText: string,
  detectedLanguage = 'en',
): Response {
  return createJsonResponse([
    {
      detectedLanguage: {
        language: detectedLanguage,
      },
      translations: [
        {
          text: translatedText,
          to: 'zh-Hans',
        },
      ],
    },
  ]);
}
