import type {
  LyricLine,
  LyricsResult,
  LyricsSource,
  TrackIdentity,
} from '@/src/domain/model';

export interface LyricsClient {
  fetchLyrics(
    track: TrackIdentity,
    targetLanguage: string,
  ): Promise<LyricsResult>;
  translateLyrics(
    lines: LyricLine[],
    targetLanguage: string,
    source: LyricsSource,
  ): Promise<LyricsResult>;
}
