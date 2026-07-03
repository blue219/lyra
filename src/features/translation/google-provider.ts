import type { LyricLine } from '../../shared/types';
import {
  applyTranslatedLines,
  googleLineJoiner,
  googleLineSeparator,
} from './line-chunks';
import {
  fromGoogleTranslateLanguage,
  toGoogleTranslateLanguage,
} from './language-codes';
import {
  classifyTranslationFailure,
  HttpStatusError,
  type TranslationAttemptResult,
} from './translation-types';

const googleTranslateUrl = 'https://translate.googleapis.com/translate_a/single';

export async function translateGoogleLineChunk(
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
      return {
        status: sourceCode === targetCode ? 'same-language' : 'same-text',
        lines,
        sourceLanguage,
      };
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

function createGoogleTranslateUrl(lines: LyricLine[], targetCode: string): URL {
  const url = new URL(googleTranslateUrl);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', targetCode);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', lines.map((line) => line.original).join(googleLineJoiner));

  return url;
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
