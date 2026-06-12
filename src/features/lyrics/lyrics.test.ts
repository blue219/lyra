import { describe, expect, test } from 'vitest';

import {
  findActiveLyricIndex,
  getLineTranslationForLanguage,
  toLyricsResult,
} from './lyrics';
import type { LrclibLyricsResponse } from './lyrics';

describe('toLyricsResult', () => {
  test('maps synced LRCLIB lyrics into original lyric lines only', () => {
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
      status: 'monolingual',
      source: 'lrclib',
      sourceLanguage: 'zh-CN',
      lines: [
        {
          timeMs: 1_000,
          original: 'Hello / 你好',
        },
        {
          timeMs: 3_500,
          original: 'World / 世界',
        },
      ],
    });
  });

  test('returns a monolingual result when synced lyrics have plain text lines', () => {
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
      source: 'lrclib',
      sourceLanguage: 'en-US',
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

  test('parses synced LRCLIB lyrics with millisecond precision timestamps', () => {
    const payload: LrclibLyricsResponse = {
      id: 1,
      trackName: 'Track',
      artistName: 'Artist',
      albumName: 'Album',
      duration: 180,
      instrumental: false,
      plainLyrics: 'Hello',
      syncedLyrics: '[00:01.234] Hello',
    };

    expect(toLyricsResult(payload)).toEqual({
      status: 'monolingual',
      source: 'lrclib',
      sourceLanguage: 'en-US',
      lines: [
        {
          timeMs: 1_234,
          original: 'Hello',
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
