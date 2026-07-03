import { isSameLyricText } from '../../shared/lyric-text';
import type { LyricLine } from '../../shared/types';
import type { TranslationLineChunk } from './translation-types';

export const googleLineSeparator = '[[LYRA_LINE_BREAK_8B4B4F0D]]';
export const googleLineJoiner = `\n${googleLineSeparator}\n`;

const googleTranslateMaxQueryLength = 1_800;

export function chunkLinesForTranslation(lines: LyricLine[]): TranslationLineChunk[] {
  const chunks: TranslationLineChunk[] = [];
  let currentLines: LyricLine[] = [];
  let currentStartIndex = 0;
  let currentLength = 0;

  const flushCurrentChunk = () => {
    if (currentLines.length === 0) {
      return;
    }

    chunks.push({
      startIndex: currentStartIndex,
      lines: currentLines,
      skipGoogle: false,
    });
    currentLines = [];
    currentLength = 0;
  };

  lines.forEach((line, index) => {
    const lineLength = line.original.length;

    if (lineLength > googleTranslateMaxQueryLength) {
      flushCurrentChunk();
      chunks.push({
        startIndex: index,
        lines: [line],
        skipGoogle: true,
      });
      return;
    }

    const nextLength =
      currentLines.length === 0
        ? lineLength
        : currentLength + googleLineJoiner.length + lineLength;

    if (currentLines.length > 0 && nextLength > googleTranslateMaxQueryLength) {
      flushCurrentChunk();
    }

    if (currentLines.length === 0) {
      currentStartIndex = index;
      currentLength = lineLength;
      currentLines = [line];
      return;
    }

    currentLength += googleLineJoiner.length + lineLength;
    currentLines.push(line);
  });

  flushCurrentChunk();

  return chunks;
}

export function replaceLinesAt(
  targetLines: LyricLine[],
  startIndex: number,
  replacementLines: LyricLine[],
): void {
  replacementLines.forEach((line, index) => {
    targetLines[startIndex + index] = line;
  });
}

export function applyTranslatedLines(
  lines: LyricLine[],
  translatedLines: string[],
  targetLanguage: string,
): LyricLine[] {
  return lines.map((line, index) => {
    const translated = normalizeTranslatedLyricText(line, translatedLines[index] ?? '');

    if (!translated || isSameLyricText(line.original, translated)) {
      return line;
    }

    return {
      ...line,
      translated,
      translatedLanguage: targetLanguage,
    };
  });
}

function normalizeTranslatedLyricText(line: LyricLine, text: string): string {
  if (isMusicalMarkerLine(line.original)) {
    return line.original.trim();
  }

  return text.replace(/\{\\[^{}]*\}/g, '').trim();
}

function isMusicalMarkerLine(text: string): boolean {
  return /^[\s♪♫♬♩]+$/u.test(text);
}
