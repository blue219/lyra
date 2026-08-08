import { afterEach, beforeEach, vi } from 'vitest';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let unexpectedConsoleErrors: unknown[][] = [];

beforeEach(() => {
  unexpectedConsoleErrors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    unexpectedConsoleErrors.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();

  if (unexpectedConsoleErrors.length > 0) {
    const messages = unexpectedConsoleErrors
      .map((args) => args.map(String).join(' '))
      .join('\n');
    throw new Error(`Unexpected console.error output:\n${messages}`);
  }
});
