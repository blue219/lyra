export interface TrackIdentity {
  title: string;
  artists: string[];
  album?: string;
}

export interface LyricLine {
  timeMs: number;
  original: string;
  translated?: string;
  translatedLanguage?: string;
}

export interface LyricsResult {
  status: 'bilingual' | 'monolingual' | 'unavailable';
  lines: LyricLine[];
}

export interface OverlaySettings {
  targetLanguage: string;
  fontSize: 'sm' | 'md' | 'lg';
  position: 'left' | 'right' | 'bottom';
}
