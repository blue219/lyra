import { describe, expect, test } from 'vitest';

import {
  HttpStatusError,
  InvalidTranslationResponseError,
  classifyTranslationFailure,
} from './translation-errors';

describe('translation HTTP failures', () => {
  test.each([
    [new HttpStatusError('limited', 429), 'rate-limited'],
    [new HttpStatusError('server', 500), 'provider-error'],
    [new InvalidTranslationResponseError('invalid'), 'invalid-response'],
    [new TypeError('offline'), 'network-error'],
    [new Error('unknown'), 'provider-error'],
  ] as const)('classifies %s as %s', (error, status) => {
    expect(classifyTranslationFailure(error)).toEqual({ status });
  });

  test('error classes expose stable names and HTTP status', () => {
    expect(new HttpStatusError('limited', 429)).toMatchObject({
      name: 'HttpStatusError',
      status: 429,
    });
    expect(new InvalidTranslationResponseError('invalid').name).toBe(
      'InvalidTranslationResponseError',
    );
  });
});
