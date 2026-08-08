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
  signal?: AbortSignal;
}

const defaultRetryDelaysMs = [200, 400];

export async function retryWithBackoff<T>({
  operation,
  shouldRetry,
  onRetry,
  delaysMs = defaultRetryDelaysMs,
  sleep = defaultSleep,
  signal,
}: RetryWithBackoffOptions<T>): Promise<T> {
  let attempt = 0;
  const maxAttempts = delaysMs.length + 1;

  while (true) {
    if (signal?.aborted) {
      throw (
        signal.reason ?? new DOMException('Operation aborted', 'AbortError')
      );
    }

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

      await (signal ? abortableSleep(delayMs, signal) : sleep(delayMs));
    }
  }
}

function abortableSleep(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(
        signal.reason ?? new DOMException('Operation aborted', 'AbortError'),
      );
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
