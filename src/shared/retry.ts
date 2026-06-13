interface RetryAttemptContext {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: unknown;
}

interface RetryWithBackoffOptions<T> {
  operation: () => Promise<T>;
  shouldRetry: (error: unknown) => boolean;
  onRetry?: (context: RetryAttemptContext) => void;
  delaysMs?: number[];
  sleep?: (delayMs: number) => Promise<void>;
}

const defaultRetryDelaysMs = [200, 400];

export async function retryWithBackoff<T>({
  operation,
  shouldRetry,
  onRetry,
  delaysMs = defaultRetryDelaysMs,
  sleep = defaultSleep,
}: RetryWithBackoffOptions<T>): Promise<T> {
  let attempt = 0;
  const maxAttempts = delaysMs.length + 1;

  while (true) {
    attempt += 1;

    try {
      return await operation();
    } catch (error) {
      const delayMs = delaysMs[attempt - 1];

      if (!shouldRetry(error) || delayMs === undefined) {
        throw error;
      }

      onRetry?.({
        attempt,
        maxAttempts,
        delayMs,
        error,
      });

      await sleep(delayMs);
    }
  }
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
