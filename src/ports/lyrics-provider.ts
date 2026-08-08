import type { LyricsResult, TrackIdentity } from '@/src/domain/model';

export interface LyricsProvider {
  fetch(track: TrackIdentity, signal: AbortSignal): Promise<LyricsResult>;
}
