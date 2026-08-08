import type { TranslationAttemptResult } from '@/src/ports/translation';

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

export function classifyTranslationFailure(error: unknown): Extract<
  TranslationAttemptResult,
  {
    status:
      | 'provider-error'
      | 'rate-limited'
      | 'network-error'
      | 'invalid-response'
      | 'timeout';
  }
> {
  if (error instanceof HttpStatusError && error.status === 429) {
    return { status: 'rate-limited' };
  }

  if (error instanceof InvalidTranslationResponseError) {
    return { status: 'invalid-response' };
  }

  if (error instanceof TypeError) {
    return { status: 'network-error' };
  }

  return { status: 'provider-error' };
}
