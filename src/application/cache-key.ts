import type {
  LyricLine,
  LyricsSource,
  TrackIdentity,
} from '@/src/domain/model';
import { createTrackCacheKey } from '@/src/domain/track';

export interface CacheIdentity {
  id: string;
  songKey: string;
}

export function createFallbackCacheIdentity(
  track: TrackIdentity,
  targetLanguage: string | null,
): CacheIdentity {
  const songKey = createTrackCacheKey(track);
  return {
    songKey,
    id: ['lrclib', songKey, targetLanguage ?? 'original'].join('::'),
  };
}

export function createSpotifyLyricsCacheIdentity(
  source: LyricsSource,
  targetLanguage: string | undefined,
  lines: LyricLine[],
): CacheIdentity {
  const lyricsFingerprint = hashString(
    JSON.stringify(lines.map((line) => line.original)),
  );
  const songKey = `${source}:${lines.length}:${lyricsFingerprint}`;

  return {
    songKey,
    id: [source, songKey, targetLanguage ?? 'original'].join('::'),
  };
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
