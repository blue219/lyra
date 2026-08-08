import type { LyricLine, LyricsDegradationReason } from '@/src/domain/model';

export type TranslationAttemptResult =
  | { status: 'translated'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'same-language'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'same-text'; lines: LyricLine[]; sourceLanguage?: string }
  | {
      status: Exclude<LyricsDegradationReason, 'same-language' | 'same-text'>;
      sourceLanguage?: string;
    };

export interface TranslationLineChunk {
  startIndex: number;
  lines: LyricLine[];
  skipGoogle: boolean;
}

export type TranslationProvider = (
  lines: LyricLine[],
  targetLanguage: string,
  signal: AbortSignal,
) => Promise<TranslationAttemptResult>;
