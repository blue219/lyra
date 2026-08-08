export interface TrackIdentity {
  title: string;
  artists: string[];
  album?: string;
  durationSeconds?: number;
}

export interface LyricLine {
  timeMs: number;
  original: string;
  translated?: string;
  translatedLanguage?: string;
}

export type LyricsSource = 'spotify' | 'lrclib';

export type LyricsUnavailableReason =
  | 'not-found'
  | 'instrumental'
  | 'provider-error'
  | 'rate-limited'
  | 'network-error'
  | 'invalid-response'
  | 'timeout'
  | 'extension-context-invalidated';

export type LyricsDegradationReason =
  | 'same-language'
  | 'same-text'
  | 'provider-error'
  | 'rate-limited'
  | 'network-error'
  | 'invalid-response'
  | 'timeout';

export interface AvailableLyricsResult {
  status: 'available';
  source: LyricsSource;
  lines: LyricLine[];
  sourceLanguage?: string;
  degradationReason?: LyricsDegradationReason;
}

export interface UnavailableLyricsResult {
  status: 'unavailable';
  reason: LyricsUnavailableReason;
  lines: [];
  source?: never;
  sourceLanguage?: never;
  degradationReason?: never;
}

export type LyricsResult = AvailableLyricsResult | UnavailableLyricsResult;

export interface OverlaySettings {
  targetLanguage: string;
  fontSize: 'sm' | 'md' | 'lg';
  dynamicBackground: boolean;
}

export interface CacheSummary {
  songCount: number;
  entryCount: number;
  maxEntries: number;
  sizeBytes: number;
}
