import type { LyricLine, LyricsResult } from '../../shared/types';

const lineSeparator = '\n';
const googleTranslateUrl = 'https://translate.googleapis.com/translate_a/single';
const googleLineSeparator = '[[LYRA_LINE_BREAK_8B4B4F0D]]';
const googleLineJoiner = `${lineSeparator}${googleLineSeparator}${lineSeparator}`;
const googleTranslateMaxQueryLength = 1_800;

type TranslationAttemptResult =
  | { status: 'translated'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'same-language'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'failed'; sourceLanguage?: string };

type GoogleLineChunk = {
  startIndex: number;
  lines: LyricLine[];
  skipGoogle: boolean;
};

export async function translateLyricsResult(
  result: LyricsResult,
  targetLanguage: string | undefined,
): Promise<LyricsResult> {
  if (result.status === 'unavailable' || result.lines.length === 0 || !targetLanguage) {
    return result;
  }

  const translationResult = await translateLyricLinesWithDetection(
    result.lines,
    targetLanguage,
  );
  const translatedLines = translationResult.lines;
  const hasAnyTranslation = translatedLines.some((line) => Boolean(line.translated));

  return {
    ...result,
    sourceLanguage: translationResult.sourceLanguage,
    status: hasAnyTranslation ? 'bilingual' : 'monolingual',
    lines: translatedLines,
  };
}

/** Translates lyric lines through the provider chain. Failures intentionally
 *  return original lines so the overlay stays readable without translation.
 */
export async function translateLyricLines(
  lines: LyricLine[],
  targetLanguage: string,
): Promise<LyricLine[]> {
  return (await translateLyricLinesWithDetection(lines, targetLanguage)).lines;
}

async function translateLyricLinesWithDetection(
  lines: LyricLine[],
  targetLanguage: string,
): Promise<{ lines: LyricLine[]; sourceLanguage?: string }> {
  if (lines.length === 0) {
    return { lines };
  }

  const googleResult = await translateWithGoogleWeb(lines, targetLanguage);

  if (googleResult.status === 'translated' || googleResult.status === 'same-language') {
    return {
      lines: googleResult.lines,
      sourceLanguage: googleResult.sourceLanguage,
    };
  }

  return { lines, sourceLanguage: googleResult.sourceLanguage };
}

async function translateWithGoogleWeb(
  lines: LyricLine[],
  targetLanguage: string,
): Promise<TranslationAttemptResult> {
  const targetCode = toGoogleTranslateLanguage(targetLanguage);

  if (!targetCode) {
    return { status: 'failed' };
  }

  const chunks = chunkLinesForGoogleTranslate(lines);
  const nextLines = [...lines];
  let sourceLanguage: string | undefined;
  let hasAnyTranslation = false;
  let hasAnyGoogleFailure = false;
  let hasAnyGoogleRequest = false;

  for (const chunk of chunks) {
    if (chunk.skipGoogle) {
      hasAnyGoogleFailure = true;
      continue;
    }

    hasAnyGoogleRequest = true;
    const chunkResult = await translateGoogleLineChunk(
      chunk.lines,
      targetLanguage,
      targetCode,
    );

    sourceLanguage = sourceLanguage ?? chunkResult.sourceLanguage;

    if (chunkResult.status === 'same-language') {
      return {
        status: 'same-language',
        lines,
        sourceLanguage: chunkResult.sourceLanguage,
      };
    }

    if (chunkResult.status === 'translated') {
      replaceLinesAt(nextLines, chunk.startIndex, chunkResult.lines);
      hasAnyTranslation ||= chunkResult.lines.some((line) => Boolean(line.translated));
      continue;
    }

    hasAnyGoogleFailure = true;
  }

  if (hasAnyTranslation) {
    return {
      status: 'translated',
      lines: nextLines,
      sourceLanguage,
    };
  }

  if (hasAnyGoogleFailure) {
    return { status: 'failed', sourceLanguage };
  }

  return { status: 'failed', sourceLanguage };
}

async function translateGoogleLineChunk(
  lines: LyricLine[],
  targetLanguage: string,
  targetCode: string,
): Promise<TranslationAttemptResult> {
  try {
    const url = createGoogleTranslateUrl(lines, targetCode);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new HttpStatusError(
        `Google Translate request failed: ${response.status}`,
        response.status,
      );
    }

    const data: unknown = await response.json();
    const sourceLanguage = readGoogleSourceLanguage(data);
    const sourceCode = toGoogleTranslateLanguage(sourceLanguage);

    if (!sourceLanguage || !sourceCode) {
      throw new Error('Unexpected Google Translate source language');
    }

    if (sourceCode === targetCode) {
      return { status: 'same-language', lines, sourceLanguage };
    }

    const translatedText = readGoogleTranslatedText(data);
    const translatedLines = translatedText.split(googleLineSeparator);

    if (translatedLines.length !== lines.length) {
      throw new Error(
        `Google Translate line count mismatch (got ${translatedLines.length}, expected ${lines.length})`,
      );
    }

    const nextLines = applyTranslatedLines(lines, translatedLines, targetLanguage);
    const hasAnyTranslation = nextLines.some((line) => Boolean(line.translated));

    if (!hasAnyTranslation) {
      throw new Error('Google Translate returned no usable lyric translations');
    }

    return {
      status: 'translated',
      lines: nextLines,
      sourceLanguage,
    };
  } catch (error) {
    console.warn(
      '[Lyra] Google Translate chunk failed, showing original lyrics for that chunk:',
      error,
    );
    return { status: 'failed' };
  }
}

function createGoogleTranslateUrl(lines: LyricLine[], targetCode: string): URL {
  const url = new URL(googleTranslateUrl);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', targetCode);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', lines.map((line) => line.original).join(googleLineJoiner));

  return url;
}

function chunkLinesForGoogleTranslate(lines: LyricLine[]): GoogleLineChunk[] {
  const chunks: GoogleLineChunk[] = [];
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

function replaceLinesAt(
  targetLines: LyricLine[],
  startIndex: number,
  replacementLines: LyricLine[],
): void {
  replacementLines.forEach((line, index) => {
    targetLines[startIndex + index] = line;
  });
}

function applyTranslatedLines(
  lines: LyricLine[],
  translatedLines: string[],
  targetLanguage: string,
): LyricLine[] {
  return lines.map((line, index) => ({
    ...line,
    translated:
      normalizeTranslatedLyricText(line, translatedLines[index] ?? '') || undefined,
    translatedLanguage: targetLanguage,
  }));
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

function toGoogleTranslateLanguage(language: string | undefined): string | null {
  if (!language) {
    return null;
  }

  if (language === 'en-US' || language === 'en') {
    return 'en';
  }

  if (language === 'zh-CN' || language === 'zh-Hans' || language === 'zh') {
    return 'zh-CN';
  }

  return null;
}

function readGoogleTranslatedText(data: unknown): string {
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected Google Translate response format');
  }

  return data[0]
    .map((segment: unknown) => {
      if (!Array.isArray(segment) || typeof segment[0] !== 'string') {
        throw new Error('Unexpected Google Translate segment format');
      }

      return segment[0];
    })
    .join('');
}

function readGoogleSourceLanguage(data: unknown): string | undefined {
  if (!Array.isArray(data) || typeof data[2] !== 'string') {
    return undefined;
  }

  return fromGoogleTranslateLanguage(data[2]);
}

class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

function fromGoogleTranslateLanguage(language: string): string | undefined {
  if (language === 'en') {
    return 'en-US';
  }

  if (language === 'zh-CN' || language === 'zh-Hans' || language === 'zh') {
    return 'zh-CN';
  }

  return undefined;
}
