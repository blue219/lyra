import { describe, expect, test } from 'vitest';

import {
  applyTranslatedLines,
  chunkLinesForTranslation,
  googleLineJoiner,
  replaceLinesAt,
} from './line-chunks';

describe('translation line chunks', () => {
  test('keeps small lines together and splits at the provider limit', () => {
    expect(
      chunkLinesForTranslation([
        { timeMs: 0, original: 'a' },
        { timeMs: 1, original: 'b' },
      ]),
    ).toHaveLength(1);
    const exact = 'a'.repeat(1_800 - googleLineJoiner.length);
    const chunks = chunkLinesForTranslation([
      { timeMs: 0, original: exact },
      { timeMs: 1, original: 'x' },
      { timeMs: 2, original: 'y'.repeat(1_801) },
      { timeMs: 3, original: 'tail' },
    ]);
    expect(
      chunks.map(({ startIndex, skipGoogle, lines }) => [
        startIndex,
        skipGoogle,
        lines.length,
      ]),
    ).toEqual([
      [0, false, 1],
      [1, false, 1],
      [2, true, 1],
      [3, false, 1],
    ]);
  });

  test('replaces translated ranges and filters empty, same, tagged, and musical text', () => {
    const target = [
      { timeMs: 0, original: 'first' },
      { timeMs: 1, original: 'second' },
    ];
    replaceLinesAt(target, 1, [{ timeMs: 1, original: 'replacement' }]);
    expect(target[1]?.original).toBe('replacement');

    expect(
      applyTranslatedLines(
        [
          { timeMs: 0, original: 'Hello' },
          { timeMs: 1, original: 'Same' },
          { timeMs: 2, original: 'Empty' },
          { timeMs: 3, original: '♪' },
        ],
        ['{\\tag} Bonjour ', 'Same', '', 'ignored'],
        'fr-FR',
      ),
    ).toEqual([
      {
        timeMs: 0,
        original: 'Hello',
        translated: 'Bonjour',
        translatedLanguage: 'fr-FR',
      },
      { timeMs: 1, original: 'Same' },
      { timeMs: 2, original: 'Empty' },
      { timeMs: 3, original: '♪' },
    ]);
  });
});
