import { describe, expect, test, vi } from 'vitest';

import { retryWithBackoff } from './retry';

describe('retryWithBackoff', () => {
  test('retries retryable failures until the operation succeeds', async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;

    const result = await retryWithBackoff({
      operation: async () => {
        attempts += 1;

        if (attempts < 3) {
          throw new Error(`temporary-${attempts}`);
        }

        return 'ok';
      },
      shouldRetry: () => true,
      sleep,
    });

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 200);
    expect(sleep).toHaveBeenNthCalledWith(2, 400);
  });

  test('stops immediately for non-retryable failures', async () => {
    const sleep = vi.fn(async () => {});
    const error = new Error('bad-request');

    await expect(
      retryWithBackoff({
        operation: async () => {
          throw error;
        },
        shouldRetry: () => false,
        sleep,
      }),
    ).rejects.toBe(error);

    expect(sleep).not.toHaveBeenCalled();
  });

  test('throws the final error after retryable failures reach the limit', async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;

    await expect(
      retryWithBackoff({
        operation: async () => {
          attempts += 1;
          throw new Error(`temporary-${attempts}`);
        },
        shouldRetry: () => true,
        sleep,
      }),
    ).rejects.toThrow('temporary-3');

    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 200);
    expect(sleep).toHaveBeenNthCalledWith(2, 400);
  });
});
