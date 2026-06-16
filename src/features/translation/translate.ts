import type { LyricLine, LyricsResult } from '../../shared/types';
import { retryWithBackoff } from '../../shared/retry';

const lineSeparator = '\n';
const googleTranslateUrl = 'https://translate.googleapis.com/translate_a/single';
const googleLineSeparator = '[[LYRA_LINE_BREAK_8B4B4F0D]]';

type TranslationAttemptResult =
  | { status: 'translated'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'same-language'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'failed'; sourceLanguage?: string };

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

/** Translates lyric lines in one LibreTranslate request. Failures intentionally
 *  return the original lines so the overlay stays readable without translation.
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

  return translateWithLibreTranslate(lines, targetLanguage, googleResult.sourceLanguage);
}

async function translateWithGoogleWeb(
  lines: LyricLine[],
  targetLanguage: string,
): Promise<TranslationAttemptResult> {
  const targetCode = toGoogleTranslateLanguage(targetLanguage);

  if (!targetCode) {
    return { status: 'failed' };
  }

  try {
    const url = new URL(googleTranslateUrl);
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'auto');
    url.searchParams.set('tl', targetCode);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', lines.map((line) => line.original).join(
      `${lineSeparator}${googleLineSeparator}${lineSeparator}`,
    ));

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
      '[Lyra] Google Translate failed, falling back to LibreTranslate:',
      error,
    );
    return { status: 'failed' };
  }
}

async function translateWithLibreTranslate(
  lines: LyricLine[],
  targetLanguage: string,
  fallbackSourceLanguage?: string,
): Promise<{ lines: LyricLine[]; sourceLanguage?: string }> {
  const targetCode = toLibreTranslateLanguage(targetLanguage);

  if (!targetCode) {
    return { lines, sourceLanguage: fallbackSourceLanguage };
  }

  const apiKey = getLibreTranslateApiKey();

  if (!apiKey) {
    console.warn('[Lyra] LibreTranslate API key is missing');
    return { lines, sourceLanguage: fallbackSourceLanguage };
  }

  const baseUrl = getLibreTranslateBaseUrl();

  if (!baseUrl) {
    console.warn('[Lyra] LibreTranslate base URL is missing');
    return { lines, sourceLanguage: fallbackSourceLanguage };
  }

  const sourceLanguage =
    fallbackSourceLanguage ?? (await detectLyricsSourceLanguage(lines, apiKey, baseUrl));
  const sourceCode = toLibreTranslateLanguage(sourceLanguage);

  if (!sourceLanguage || !sourceCode || sourceCode === targetCode) {
    return {
      lines,
      sourceLanguage,
    };
  }

  try {
    const response = await retryWithBackoff({
      operation: async () => {
        const nextResponse = await fetch(`${baseUrl}/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: lines.map((line) => line.original).join(lineSeparator),
            source: sourceCode,
            target: targetCode,
            format: 'text',
            api_key: apiKey,
          }),
        });

        if (!nextResponse.ok) {
          throw new HttpStatusError(
            `LibreTranslate request failed: ${nextResponse.status}`,
            nextResponse.status,
          );
        }

        return nextResponse;
      },
      shouldRetry: isTransientRequestError,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        console.warn(
          `[Lyra] Translation request transient failure on attempt ${attempt}/${maxAttempts}; retrying in ${delayMs}ms:`,
          error,
        );
      },
    });

    const data: unknown = await response.json();

    if (
      !data ||
      typeof data !== 'object' ||
      typeof (data as { translatedText?: unknown }).translatedText !== 'string'
    ) {
      throw new Error('Unexpected LibreTranslate response format');
    }

    const translatedLines = (data as { translatedText: string }).translatedText.split(
      lineSeparator,
    );

    if (translatedLines.length !== lines.length) {
      console.warn(
        `[Lyra] Translation line count mismatch (got ${translatedLines.length}, expected ${lines.length})`,
      );
      return { lines, sourceLanguage };
    }

    return {
      lines: applyTranslatedLines(lines, translatedLines, targetLanguage),
      sourceLanguage,
    };
  } catch (error) {
    console.warn(
      '[Lyra] Translation failed after retry exhaustion or a non-retryable error, showing original lyrics:',
      error,
    );
    return { lines, sourceLanguage };
  }
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

function toLibreTranslateLanguage(language: string | undefined): string | null {
  if (!language) {
    return null;
  }

  if (language === 'en-US' || language === 'en') {
    return 'en';
  }

  if (language === 'zh-CN' || language === 'zh-Hans') {
    return 'zh-Hans';
  }

  return null;
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

async function detectLyricsSourceLanguage(
  lines: LyricLine[],
  apiKey: string,
  baseUrl: string,
): Promise<string | undefined> {
  try {
    const response = await retryWithBackoff({
      operation: async () => {
        const nextResponse = await fetch(`${baseUrl}/detect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: lines.map((line) => line.original).join(lineSeparator),
            api_key: apiKey,
          }),
        });

        if (!nextResponse.ok) {
          throw new HttpStatusError(
            `LibreTranslate detect request failed: ${nextResponse.status}`,
            nextResponse.status,
          );
        }

        return nextResponse;
      },
      shouldRetry: isTransientRequestError,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        console.warn(
          `[Lyra] Language detection transient failure on attempt ${attempt}/${maxAttempts}; retrying in ${delayMs}ms:`,
          error,
        );
      },
    });

    const data: unknown = await response.json();

    const detectedLanguage = Array.isArray(data)
      ? (data[0] as { language?: unknown } | undefined)?.language
      : (data as { language?: unknown } | null)?.language;

    if (typeof detectedLanguage !== 'string') {
      throw new Error('Unexpected LibreTranslate detect response format');
    }

    return fromLibreTranslateLanguage(detectedLanguage);
  } catch (error) {
    console.warn(
      '[Lyra] Language detection failed after retry exhaustion or a non-retryable error, showing original lyrics:',
      error,
    );
    return undefined;
  }
}

function isTransientRequestError(error: unknown): boolean {
  return error instanceof TypeError || isRetryableHttpStatusError(error);
}

function isRetryableHttpStatusError(error: unknown): boolean {
  return error instanceof HttpStatusError && (error.status === 429 || error.status >= 500);
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

function fromLibreTranslateLanguage(language: string): string | undefined {
  if (language === 'en') {
    return 'en-US';
  }

  if (language === 'zh-Hans') {
    return 'zh-CN';
  }

  return undefined;
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

function getLibreTranslateBaseUrl(): string | undefined {
  const value = (import.meta.env.VITE_LIBRETRANSLATE_BASE_URL as string | undefined)
    ?.replace(/\/+$/, '')
    .trim();

  return value || undefined;
}

function getLibreTranslateApiKey(): string | undefined {
  const value = import.meta.env.VITE_LIBRETRANSLATE_API_KEY as string | undefined;
  return value?.trim() || undefined;
}
