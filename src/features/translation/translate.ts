import type { LyricLine, LyricsResult } from '../../shared/types';

const lineSeparator = '\n';
const googleTranslateUrl = 'https://translate.googleapis.com/translate_a/single';
const microsoftTranslatorPageUrl = 'https://translator.bing.com/';
const bingTranslatorPageUrl = 'https://www.bing.com/translator';
const googleLineSeparator = '[[LYRA_LINE_BREAK_8B4B4F0D]]';
const googleLineJoiner = `${lineSeparator}${googleLineSeparator}${lineSeparator}`;
const googleTranslateMaxQueryLength = 1_800;

type TranslationAttemptResult =
  | { status: 'translated'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'same-language'; lines: LyricLine[]; sourceLanguage?: string }
  | {
      status: 'failed' | 'rate-limited' | 'invalid-response';
      sourceLanguage?: string;
    };

type TranslationLineChunk = {
  startIndex: number;
  lines: LyricLine[];
  skipGoogle: boolean;
};

interface BingWebSession {
  endpointUrl: URL;
  token: string;
  key: string;
}

interface BingWebProviderConfig {
  name: 'Microsoft Translator web' | 'Bing Translator web';
  pageUrl: string;
}

type TranslationProvider = (
  lines: LyricLine[],
  targetLanguage: string,
) => Promise<TranslationAttemptResult>;

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

  const translationResult = await translateWithProviderChain(lines, targetLanguage);

  if (
    translationResult.status === 'translated' ||
    translationResult.status === 'same-language'
  ) {
    return {
      lines: translationResult.lines,
      sourceLanguage: translationResult.sourceLanguage,
    };
  }

  return { lines, sourceLanguage: translationResult.sourceLanguage };
}

async function translateWithProviderChain(
  lines: LyricLine[],
  targetLanguage: string,
): Promise<TranslationAttemptResult> {
  const chunks = chunkLinesForTranslation(lines);
  const translatableChunks = chunks.filter((chunk) => !chunk.skipGoogle);

  if (translatableChunks.length === 0) {
    return { status: 'failed' };
  }

  const nextLines = [...lines];
  const providers: TranslationProvider[] = [
    translateGoogleLineChunk,
    createBingWebProvider({
      name: 'Microsoft Translator web',
      pageUrl: microsoftTranslatorPageUrl,
    }),
    createBingWebProvider({
      name: 'Bing Translator web',
      pageUrl: bingTranslatorPageUrl,
    }),
  ];

  let sourceLanguage: string | undefined;
  let hasAnyTranslation = false;
  let pendingChunks = translatableChunks;
  let lastFailureStatus: TranslationAttemptResult['status'] = 'failed';

  for (const provider of providers) {
    const failedChunks: TranslationLineChunk[] = [];

    for (const chunk of pendingChunks) {
      const chunkResult = await provider(chunk.lines, targetLanguage);
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
        hasAnyTranslation ||= chunkResult.lines.some((line) =>
          Boolean(line.translated),
        );
        continue;
      }

      lastFailureStatus = chunkResult.status;
      failedChunks.push(chunk);
    }

    pendingChunks = failedChunks;

    if (pendingChunks.length === 0) {
      break;
    }
  }

  if (hasAnyTranslation) {
    return {
      status: 'translated',
      lines: nextLines,
      sourceLanguage,
    };
  }

  return { status: lastFailureStatus, sourceLanguage };
}

async function translateGoogleLineChunk(
  lines: LyricLine[],
  targetLanguage: string,
): Promise<TranslationAttemptResult> {
  const targetCode = toGoogleTranslateLanguage(targetLanguage);

  if (!targetCode) {
    return { status: 'failed' };
  }

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
    return classifyTranslationFailure(error);
  }
}

function createBingWebProvider(config: BingWebProviderConfig): TranslationProvider {
  let sessionPromise: Promise<BingWebSession> | undefined;

  return async (lines, targetLanguage) => {
    const targetCode = toMicrosoftTranslateLanguage(targetLanguage);

    if (!targetCode) {
      return { status: 'failed' };
    }

    try {
      sessionPromise ??= fetchBingWebSession(config.pageUrl);
      const session = await sessionPromise;
      const response = await fetch(session.endpointUrl.toString(), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Referer: config.pageUrl,
        },
        body: createBingWebRequestBody(lines, targetCode, session),
      });

      if (!response.ok) {
        throw new HttpStatusError(
          `${config.name} request failed: ${response.status}`,
          response.status,
        );
      }

      const data: unknown = await response.json();
      const sourceLanguage = readMicrosoftSourceLanguage(data);
      const sourceCode = toMicrosoftTranslateLanguage(sourceLanguage);

      if (!sourceLanguage || !sourceCode) {
        throw new InvalidTranslationResponseError(
          `Unexpected ${config.name} source language`,
        );
      }

      if (sourceCode === targetCode) {
        return { status: 'same-language', lines, sourceLanguage };
      }

      const translatedText = readMicrosoftTranslatedText(data);
      const translatedLines = translatedText.split(googleLineSeparator);

      if (translatedLines.length !== lines.length) {
        throw new InvalidTranslationResponseError(
          `${config.name} line count mismatch (got ${translatedLines.length}, expected ${lines.length})`,
        );
      }

      const nextLines = applyTranslatedLines(lines, translatedLines, targetLanguage);
      const hasAnyTranslation = nextLines.some((line) => Boolean(line.translated));

      if (!hasAnyTranslation) {
        throw new InvalidTranslationResponseError(
          `${config.name} returned no usable lyric translations`,
        );
      }

      return {
        status: 'translated',
        lines: nextLines,
        sourceLanguage,
      };
    } catch (error) {
      console.warn(
        `[Lyra] ${config.name} chunk failed, trying the next translation provider:`,
        error,
      );
      return classifyTranslationFailure(error);
    }
  };
}

async function fetchBingWebSession(pageUrl: string): Promise<BingWebSession> {
  const response = await fetch(pageUrl, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new HttpStatusError(
      `Translator page request failed: ${response.status}`,
      response.status,
    );
  }

  return readBingWebSession(await response.text(), pageUrl);
}

function readBingWebSession(html: string, pageUrl: string): BingWebSession {
  const ig =
    readFirstRegexCapture(html, /\bIG:"([^"]+)"/) ??
    readFirstRegexCapture(html, /"IG":"([^"]+)"/);
  const authMatch = html.match(
    /params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)",\d+\]/,
  );

  if (!ig || !authMatch) {
    throw new InvalidTranslationResponseError('Translator page session missing');
  }

  const endpointPath =
    readFirstRegexCapture(html, /params_RichTranslate\s*=\s*\[\s*"([^"]+)"/) ??
    '/ttranslatev3?isVertical=1&';
  const endpointUrl = new URL(decodeBingJavascriptString(endpointPath), pageUrl);

  endpointUrl.searchParams.set('IG', ig);
  endpointUrl.searchParams.set('IID', 'translator.5028');

  return {
    endpointUrl,
    key: authMatch[1] ?? '',
    token: authMatch[2] ?? '',
  };
}

function decodeBingJavascriptString(value: string): string {
  return value.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
}

function createBingWebRequestBody(
  lines: LyricLine[],
  targetCode: string,
  session: BingWebSession,
): URLSearchParams {
  const body = new URLSearchParams();

  body.set('fromLang', 'auto-detect');
  body.set('text', lines.map((line) => line.original).join(googleLineJoiner));
  body.set('to', targetCode);
  body.set('token', session.token);
  body.set('key', session.key);

  return body;
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

function chunkLinesForTranslation(lines: LyricLine[]): TranslationLineChunk[] {
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

function toMicrosoftTranslateLanguage(language: string | undefined): string | null {
  if (!language) {
    return null;
  }

  if (language === 'en-US' || language === 'en') {
    return 'en';
  }

  if (language === 'zh-CN' || language === 'zh-Hans' || language === 'zh') {
    return 'zh-Hans';
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

function readMicrosoftTranslatedText(data: unknown): string {
  const firstResult = readFirstMicrosoftResult(data);
  const translations = firstResult.translations;

  if (!Array.isArray(translations)) {
    throw new InvalidTranslationResponseError(
      'Unexpected Microsoft Translator translations format',
    );
  }

  const firstTranslation = translations[0];

  if (
    !firstTranslation ||
    typeof firstTranslation !== 'object' ||
    typeof (firstTranslation as { text?: unknown }).text !== 'string'
  ) {
    throw new InvalidTranslationResponseError(
      'Unexpected Microsoft Translator translation format',
    );
  }

  return (firstTranslation as { text: string }).text;
}

function readMicrosoftSourceLanguage(data: unknown): string | undefined {
  const firstResult = readFirstMicrosoftResult(data);
  const detectedLanguage = firstResult.detectedLanguage;

  if (!detectedLanguage || typeof detectedLanguage !== 'object') {
    return undefined;
  }

  const language = (detectedLanguage as { language?: unknown }).language;

  return typeof language === 'string'
    ? fromMicrosoftTranslateLanguage(language)
    : undefined;
}

function readFirstMicrosoftResult(data: unknown): Record<string, unknown> {
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') {
    throw new InvalidTranslationResponseError(
      'Unexpected Microsoft Translator response format',
    );
  }

  return data[0] as Record<string, unknown>;
}

function readFirstRegexCapture(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1];
}

function classifyTranslationFailure(
  error: unknown,
): Extract<TranslationAttemptResult, { status: 'failed' | 'rate-limited' | 'invalid-response' }> {
  if (error instanceof HttpStatusError && error.status === 429) {
    return { status: 'rate-limited' };
  }

  if (error instanceof InvalidTranslationResponseError) {
    return { status: 'invalid-response' };
  }

  return { status: 'failed' };
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

class InvalidTranslationResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTranslationResponseError';
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

function fromMicrosoftTranslateLanguage(language: string): string | undefined {
  if (language === 'en') {
    return 'en-US';
  }

  if (language === 'zh-CN' || language === 'zh-Hans' || language === 'zh') {
    return 'zh-CN';
  }

  return undefined;
}
