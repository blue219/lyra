import type { LyricLine, LyricsResult } from './types';

export interface LrclibLyricsResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const translationSeparators = [' / ', ' | ', ' ／ ', ' ｜ '];

export function toLyricsResult(payload: LrclibLyricsResponse): LyricsResult {
  if (payload.instrumental || !payload.syncedLyrics?.trim()) {
    return {
      status: 'unavailable',
      lines: [],
    };
  }

  const lines = parseSyncedLyrics(payload.syncedLyrics);
  const hasTranslations = lines.some((line) => Boolean(line.translated));

  return {
    status: hasTranslations ? 'bilingual' : 'monolingual',
    lines,
  };
}

export function findActiveLyricIndex(
  lines: LyricLine[],
  currentTimeMs: number,
): number {
  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].timeMs > currentTimeMs) {
      break;
    }

    activeIndex = index;
  }

  return activeIndex;
}

export function getLineTranslationForLanguage(
  line: LyricLine,
  targetLanguage: string,
): string | undefined {
  if (!line.translated) {
    return undefined;
  }

  if (!line.translatedLanguage) {
    return line.translated;
  }

  return line.translatedLanguage === targetLanguage ? line.translated : undefined;
}

function parseSyncedLyrics(syncedLyrics: string): LyricLine[] {
  return syncedLyrics
    .split('\n')
    .map((line) => line.trimEnd())
    .map(parseLrcLine)
    .filter((line): line is LyricLine => line !== null);
}

function parseLrcLine(line: string): LyricLine | null {
  const match = line.match(/^\[(\d{2,3}):(\d{2}(?:\.\d{1,2})?)\]\s?(.*)$/);

  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const text = match[3] ?? '';
  const pair = splitLyricPair(text);

  return {
    timeMs: Math.round((minutes * 60 + seconds) * 1000),
    original: pair.original,
    translated: pair.translated,
    translatedLanguage: pair.translatedLanguage,
  };
}

function splitLyricPair(text: string): {
  original: string;
  translated?: string;
  translatedLanguage?: string;
} {
  const trimmed = text.trim();

  for (const separator of translationSeparators) {
    const parts = trimmed.split(separator);

    // LRCLIB has no dedicated translation field, so we only split when the
    // contributor already embedded a clean bilingual pair into one timed line.
    if (parts.length === 2 && parts[0]?.trim() && parts[1]?.trim()) {
      return {
        original: parts[0].trim(),
        translated: parts[1].trim(),
        translatedLanguage: detectLanguage(parts[1].trim()),
      };
    }
  }

  return {
    original: trimmed,
  };
}

function detectLanguage(text: string): string | undefined {
  if (!text) {
    return undefined;
  }

  if (/[ぁ-ゖ゠-ヿ]/u.test(text)) {
    return 'ja-JP';
  }

  if (/[一-龯]/u.test(text)) {
    return 'zh-CN';
  }

  if (/[ñáéíóúü¿¡]/iu.test(text)) {
    return 'es-ES';
  }

  if (/^[\p{Script=Latin}\p{Number}\p{Punctuation}\s]+$/u.test(text)) {
    return 'en-US';
  }

  return undefined;
}
