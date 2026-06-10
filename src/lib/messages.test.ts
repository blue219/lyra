import { afterEach, describe, expect, test, vi } from 'vitest';

import { requestLyrics } from './messages';

describe('requestLyrics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'browser');
  });

  test('returns an unavailable result when the extension context has been invalidated', async () => {
    (globalThis as Record<string, unknown>).browser = {
      runtime: {
        sendMessage: vi.fn(() => {
          throw new Error('Extension context invalidated.');
        }),
      },
    } as unknown as typeof browser;

    await expect(
      requestLyrics({
        title: 'Home Sweet Home',
        artists: ['YUKI'],
      }),
    ).resolves.toEqual({
      status: 'unavailable',
      lines: [],
    });
  });
});
