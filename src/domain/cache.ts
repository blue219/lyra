import type { LyricsResult, LyricsSource } from './model';

export const lyricsCacheV2StorageKey = 'lyricsCacheV2';
export const legacyLyricsCacheStorageKey = 'lyricsCache';
export const maxLyricsCacheEntries = 200;

export interface LyricsCacheEntryV2 {
  version: 2;
  id: string;
  songKey: string;
  source: LyricsSource;
  targetLanguage: string | null;
  expiresAt: number | null;
  lastAccessedAt: number;
  result: LyricsResult;
}
