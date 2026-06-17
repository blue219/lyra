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
  if (payload.instrumental) {
    return {
      status: 'unavailable',
      unavailableReason: 'instrumental',
      lines: [],
    };
  }

  if (!payload.syncedLyrics?.trim()) {
    return {
      status: 'unavailable',
      unavailableReason: 'not-found',
      lines: [],
    };
  }

  const lines = parseSyncedLyrics(payload.syncedLyrics);

  if (lines.length === 0) {
    return {
      status: 'unavailable',
      unavailableReason: 'not-found',
      lines: [],
    };
  }

  return {
    status: 'monolingual',
    lines,
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
  const text = normalizeLrcLyricText(match[4] ?? '');

  return {
    timeMs: (minutes * 60 + seconds) * 1000 + milliseconds,
    original: text,
  };
}

function normalizeLrcLyricText(text: string): string {
  return text.replace(/\{\\[^{}]*\}/g, '').trim();
}
