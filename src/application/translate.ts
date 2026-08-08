import type {
  LyricLine,
  LyricsDegradationReason,
  LyricsResult,
} from '@/src/domain/model';
import { isSameSupportedLanguage } from '@/src/domain/languages';
import {
  chunkLinesForTranslation,
  replaceLinesAt,
} from '@/src/application/line-chunks';
import { throwIfCancelled } from './abort';
import type {
  TranslationAttemptResult,
  TranslationLineChunk,
  TranslationProvider,
} from '@/src/ports/translation';

export function createTranslationOrchestrator(
  providers: readonly TranslationProvider[],
) {
  return async function translateLyricsResult(
    result: LyricsResult,
    targetLanguage: string | undefined,
    signal: AbortSignal,
  ): Promise<LyricsResult> {
    if (result.status === 'unavailable' || !targetLanguage) {
      return result;
    }

    throwIfCancelled(signal);

    if (isSameSupportedLanguage(result.sourceLanguage, targetLanguage)) {
      return {
        ...result,
        degradationReason: 'same-language',
        lines: removeTranslations(result.lines),
      };
    }

    const translation = await translateLyricLines(
      result.lines,
      targetLanguage,
      providers,
      signal,
    );

    return {
      ...result,
      sourceLanguage: translation.sourceLanguage,
      degradationReason:
        translation.status === 'translated' ? undefined : translation.status,
      lines:
        translation.status === 'translated' ? translation.lines : result.lines,
    };
  };
}

export async function translateLyricLines(
  lines: LyricLine[],
  targetLanguage: string,
  providers: readonly TranslationProvider[],
  signal: AbortSignal,
): Promise<TranslationAttemptResult> {
  if (lines.length === 0 || providers.length === 0) {
    return { status: 'provider-error' };
  }

  const chunks = chunkLinesForTranslation(lines);
  const translatableChunks = chunks.filter((chunk) => !chunk.skipGoogle);

  if (translatableChunks.length === 0) {
    return { status: 'same-text', lines };
  }

  const nextLines = [...lines];
  let sourceLanguage: string | undefined;
  let hasTranslation = false;
  let hasSameLanguage = false;
  let hasSameText = false;
  let pendingChunks = translatableChunks;
  let lastFailure: LyricsDegradationReason = 'provider-error';

  for (const provider of providers) {
    const failedChunks: TranslationLineChunk[] = [];

    for (const chunk of pendingChunks) {
      throwIfCancelled(signal);
      const result = await provider(chunk.lines, targetLanguage, signal);
      sourceLanguage ??= result.sourceLanguage;

      if (result.status === 'translated') {
        replaceLinesAt(nextLines, chunk.startIndex, result.lines);
        hasTranslation = true;
      } else if (result.status === 'same-language') {
        hasSameLanguage = true;
      } else if (result.status === 'same-text') {
        hasSameText = true;
      } else {
        lastFailure = result.status;
        failedChunks.push(chunk);
      }
    }

    pendingChunks = failedChunks;
    if (pendingChunks.length === 0) break;
  }

  if (hasTranslation) {
    return { status: 'translated', lines: nextLines, sourceLanguage };
  }

  if (pendingChunks.length === 0 && hasSameLanguage) {
    return { status: 'same-language', lines, sourceLanguage };
  }

  if (pendingChunks.length === 0 && hasSameText) {
    return { status: 'same-text', lines, sourceLanguage };
  }

  return { status: lastFailure, sourceLanguage };
}

function removeTranslations(lines: LyricLine[]): LyricLine[] {
  return lines.map((line) => ({
    timeMs: line.timeMs,
    original: line.original,
  }));
}
