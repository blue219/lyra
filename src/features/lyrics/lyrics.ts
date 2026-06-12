import type { LyricLine, LyricsResult } from '../../shared/types';

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

export function toLyricsResult(payload: LrclibLyricsResponse): LyricsResult {
  if (payload.instrumental || !payload.syncedLyrics?.trim()) {
    return {
      status: 'unavailable',
      lines: [],
    };
  }

  const lines = parseSyncedLyrics(payload.syncedLyrics);

  if (lines.length === 0) {
    return {
      status: 'unavailable',
      lines: [],
    };
  }

  return {
    status: 'monolingual',
    lines,
    sourceLanguage: detectSourceLanguage(lines),
    source: 'lrclib',
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
    .map((line) => parseLrcLine(line))
    .filter((line): line is LyricLine => line !== null);
}

function parseLrcLine(line: string): LyricLine | null {
  const match = line.match(/^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s?(.*)$/);

  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const milliseconds = Number((match[3] ?? '').padEnd(3, '0'));
  const text = match[4] ?? '';

  return {
    timeMs: (minutes * 60 + seconds) * 1000 + milliseconds,
    original: text.trim(),
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

export function detectSourceLanguage(lines: LyricLine[]): string | undefined {
  const counts = new Map<string, number>();

  for (const line of lines) {
    if (!line.original) continue;
    const lang = detectLanguage(line.original);
    if (lang) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return undefined;

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}
