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

  test('reports retries and supports custom delays', async () => {
    const onRetry = vi.fn();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue('ok');
    await expect(
      retryWithBackoff({
        operation,
        shouldRetry: () => true,
        delaysMs: [5],
        sleep: vi.fn().mockResolvedValue(undefined),
        onRetry,
      }),
    ).resolves.toBe('ok');
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, maxAttempts: 2, delayMs: 5 }),
    );
  });

  test('rejects before work and while sleeping when cancelled', async () => {
    const before = new AbortController();
    before.abort(new DOMException('cancelled', 'AbortError'));
    await expect(
      retryWithBackoff({
        operation: vi.fn(),
        shouldRetry: () => true,
        signal: before.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    const during = new AbortController();
    const pending = retryWithBackoff({
      operation: vi.fn().mockRejectedValue(new Error('temporary')),
      shouldRetry: () => true,
      delaysMs: [10_000],
      signal: during.signal,
    });
    await Promise.resolve();
    await Promise.resolve();
    during.abort(new DOMException('changed', 'AbortError'));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('uses the default sleep implementation', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue('ok');
    const pending = retryWithBackoff({
      operation,
      shouldRetry: () => true,
      delaysMs: [1],
    });
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('ok');
    vi.useRealTimers();
  });
});
