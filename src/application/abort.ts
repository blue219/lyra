import { systemClock, type Clock } from '@/src/ports/clock';

export const httpAttemptTimeoutMs = 8_000;
export const lyricsFlowTimeoutMs = 25_000;

export interface AttemptSignal {
  signal: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
}

export function createAttemptSignal(
  parentSignal: AbortSignal,
  timeoutMs = httpAttemptTimeoutMs,
  clock: Clock = systemClock,
): AttemptSignal {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromParent = () => controller.abort(parentSignal.reason);
  parentSignal.addEventListener('abort', abortFromParent, { once: true });

  if (parentSignal.aborted) {
    abortFromParent();
  }

  const timeoutHandle = clock.setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clock.clearTimeout(timeoutHandle);
      parentSignal.removeEventListener('abort', abortFromParent);
    },
  };
}

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException('Operation aborted', 'AbortError');
  }
}
