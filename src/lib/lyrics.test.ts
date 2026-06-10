import { describe, expect, test } from 'vitest';

import {
  findActiveLyricIndex,
  getLineTranslationForLanguage,
  toLyricsResult,
} from './lyrics';
import type { LrclibLyricsResponse } from './lyrics';

describe('toLyricsResult', () => {
  test('maps synced LRCLIB lyrics into bilingual lines when a line includes a translation separator', () => {
    const payload: LrclibLyricsResponse = {
      id: 1,
      trackName: 'Track',
      artistName: 'Artist',
      albumName: 'Album',
      duration: 180,
      instrumental: false,
      plainLyrics: 'Hello\nWorld',
      syncedLyrics: '[00:01.00] Hello / 你好\n[00:03.50] World / 世界',
    };

    expect(toLyricsResult(payload)).toEqual({
      status: 'bilingual',
      lines: [
        {
          timeMs: 1_000,
          original: 'Hello',
          translated: '你好',
          translatedLanguage: 'zh-CN',
        },
        {
          timeMs: 3_500,
          original: 'World',
          translated: '世界',
          translatedLanguage: 'zh-CN',
        },
      ],
    });
  });

  test('returns a monolingual result when synced lyrics have no detected translation pair', () => {
    const payload: LrclibLyricsResponse = {
      id: 1,
      trackName: 'Track',
      artistName: 'Artist',
      albumName: 'Album',
      duration: 180,
      instrumental: false,
      plainLyrics: 'Hello\nWorld',
      syncedLyrics: '[00:01.00] Hello\n[00:03.50] World',
    };

    expect(toLyricsResult(payload)).toEqual({
      status: 'monolingual',
      lines: [
        {
          timeMs: 1_000,
          original: 'Hello',
        },
        {
          timeMs: 3_500,
          original: 'World',
        },
      ],
    });
  });

  test('returns unavailable when LRCLIB has no synced lyrics', () => {
    const payload: LrclibLyricsResponse = {
      id: 1,
      trackName: 'Track',
      artistName: 'Artist',
      albumName: 'Album',
      duration: 180,
      instrumental: false,
      plainLyrics: 'Hello\nWorld',
      syncedLyrics: null,
    };

    expect(toLyricsResult(payload)).toEqual({
      status: 'unavailable',
      lines: [],
    });
  });
});

describe('findActiveLyricIndex', () => {
  const lines = [
    { timeMs: 1_000, original: 'First' },
    { timeMs: 3_500, original: 'Second' },
    { timeMs: 7_250, original: 'Third' },
  ];

  test('returns the latest started line at the current playback time', () => {
    expect(findActiveLyricIndex(lines, 5_000)).toBe(1);
  });

  test('returns -1 before the first line starts', () => {
    expect(findActiveLyricIndex(lines, 500)).toBe(-1);
  });
});

describe('getLineTranslationForLanguage', () => {
  test('returns the translation only when the detected language matches the selected language', () => {
    expect(
      getLineTranslationForLanguage(
        {
          timeMs: 1_000,
          original: 'さよなら',
          translated: 'Goodbye',
          translatedLanguage: 'en-US',
        },
        'en-US',
      ),
    ).toBe('Goodbye');
  });

  test('hides translations for a different target language', () => {
    expect(
      getLineTranslationForLanguage(
        {
          timeMs: 1_000,
          original: 'さよなら',
          translated: 'Goodbye',
          translatedLanguage: 'en-US',
        },
        'zh-CN',
      ),
    ).toBeUndefined();
  });
});
