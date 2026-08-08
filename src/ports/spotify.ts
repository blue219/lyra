import type { LyricLine, TrackIdentity } from '@/src/domain/model';

export interface SpotifySnapshot {
  activeLineIndex: number;
  lyricsLines: LyricLine[];
  track: TrackIdentity | null;
  hasUnsyncedLyrics: boolean;
  lyricsContainer: HTMLElement | null;
}

export interface SpotifyPort {
  readSnapshot(): SpotifySnapshot;
  readPlaybackPositionMs(): number | null;
  isDocumentVisible(): boolean;
  observe(listener: () => void): () => void;
}
