import type { LyricLine, LyricsResult } from '../../shared/types';
import { isSameSupportedLanguage } from '../../shared/supported-languages';
import { createBingWebProvider } from './bing-web-provider';
import { translateGoogleLineChunk } from './google-provider';
import {
  chunkLinesForTranslation,
  replaceLinesAt,
} from './line-chunks';
import type {
  TranslationAttemptResult,
  TranslationLineChunk,
  TranslationProvider,
} from './translation-types';

const microsoftTranslatorPageUrl = 'https://translator.bing.com/';
const bingTranslatorPageUrl = 'https://www.bing.com/translator';

export async function translateLyricsResult(
  result: LyricsResult,
  targetLanguage: string | undefined,
): Promise<LyricsResult> {
  if (result.status === 'unavailable' || result.lines.length === 0 || !targetLanguage) {
    return result;
  }

  if (isSameSupportedLanguage(result.sourceLanguage, targetLanguage)) {
    return {
      ...result,
      status: 'monolingual',
      translationSkippedReason: 'same-language',
      lines: result.lines.map(({ translated, translatedLanguage, ...line }) => line),
    };
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
    translationSkippedReason:
      translationResult.status === 'same-text' ||
      translationResult.status === 'same-language'
        ? translationResult.status
        : undefined,
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
): Promise<{
  lines: LyricLine[];
  sourceLanguage?: string;
  status: TranslationAttemptResult['status'];
}> {
  if (lines.length === 0) {
    return { lines, status: 'failed' };
  }

  const translationResult = await translateWithProviderChain(lines, targetLanguage);

  if (
    translationResult.status === 'translated' ||
    translationResult.status === 'same-language' ||
    translationResult.status === 'same-text'
  ) {
    return {
      lines: translationResult.lines,
      sourceLanguage: translationResult.sourceLanguage,
      status: translationResult.status,
    };
  }

  return {
    lines,
    sourceLanguage: translationResult.sourceLanguage,
    status: translationResult.status,
  };
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
  let hasAnySameLanguage = false;
  let hasAnySameText = false;
  let pendingChunks = translatableChunks;
  let lastFailureStatus: TranslationAttemptResult['status'] = 'failed';

  for (const provider of providers) {
    const failedChunks: TranslationLineChunk[] = [];

    for (const chunk of pendingChunks) {
      const chunkResult = await provider(chunk.lines, targetLanguage);
      sourceLanguage = sourceLanguage ?? chunkResult.sourceLanguage;

      if (chunkResult.status === 'same-language') {
        // Provider language detection can be noisy on mixed lyric chunks. Keep
        // the current chunk monolingual, but continue translating the rest.
        hasAnySameLanguage = true;
        continue;
      }

      if (chunkResult.status === 'same-text') {
        hasAnySameText = true;
        continue;
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

  if (hasAnySameLanguage && pendingChunks.length === 0) {
    return {
      status: 'same-language',
      lines,
      sourceLanguage,
    };
  }

  if (hasAnySameText && pendingChunks.length === 0) {
    return {
      status: 'same-text',
      lines,
      sourceLanguage,
    };
  }

  return { status: lastFailureStatus, sourceLanguage };
}
