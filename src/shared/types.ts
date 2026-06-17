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

export type LyricsUnavailableReason =
  | 'not-found'
  | 'instrumental'
  | 'provider-error'
  | 'rate-limited'
  | 'network-error'
  | 'invalid-response'
  | 'extension-context-invalidated';

export interface LyricsResult {
  status: 'bilingual' | 'monolingual' | 'unavailable';
  lines: LyricLine[];
  sourceLanguage?: string;
  translationSkippedReason?: 'same-language' | 'same-text';
  source?: 'spotify' | 'lrclib';
  unavailableReason?: LyricsUnavailableReason;
}

export interface OverlaySettings {
  targetLanguage: string;
  fontSize: 'sm' | 'md' | 'lg';
}
