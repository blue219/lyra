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

  test('keeps a Google-failed chunk as original while preserving translated chunks', async () => {
    const lines: LyricLine[] = [
      { timeMs: 1_000, original: 'First '.repeat(250) },
      { timeMs: 2_000, original: 'Second '.repeat(100) },
      { timeMs: 3_000, original: 'Third '.repeat(100) },
    ];

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const query = new URL(String(input)).searchParams.get('q');

      if (query === lines[0]?.original) {
        return createGoogleTranslateResponse(['第一']);
      }

      return createGoogleTranslateResponse(['第二第三']);
    });

    const result = await translateLyricLines(lines, 'zh-CN');

    expect(result.map((line) => line.translated)).toEqual(['第一', undefined, undefined]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls.flat()).toContainEqual(
      expect.stringContaining('Google Translate chunk failed'),
    );
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
        translated: '♪',
        translatedLanguage: 'zh-CN',
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
