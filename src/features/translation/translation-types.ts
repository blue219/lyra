import type { LyricLine } from '../../shared/types';

export type TranslationAttemptResult =
  | { status: 'translated'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'same-language'; lines: LyricLine[]; sourceLanguage?: string }
  | { status: 'same-text'; lines: LyricLine[]; sourceLanguage?: string }
  | {
      status: 'failed' | 'rate-limited' | 'invalid-response';
      sourceLanguage?: string;
    };

export type TranslationLineChunk = {
  startIndex: number;
  lines: LyricLine[];
  skipGoogle: boolean;
};

export type TranslationProvider = (
  lines: LyricLine[],
  targetLanguage: string,
) => Promise<TranslationAttemptResult>;

export class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

export class InvalidTranslationResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTranslationResponseError';
  }
}

export function classifyTranslationFailure(
  error: unknown,
): Extract<TranslationAttemptResult, { status: 'failed' | 'rate-limited' | 'invalid-response' }> {
  if (error instanceof HttpStatusError && error.status === 429) {
    return { status: 'rate-limited' };
  }

  if (error instanceof InvalidTranslationResponseError) {
    return { status: 'invalid-response' };
  }

  return { status: 'failed' };
}
