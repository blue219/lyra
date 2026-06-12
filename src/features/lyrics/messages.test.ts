import { afterEach, describe, expect, test, vi } from 'vitest';

import { requestLyrics, requestTranslatedLyrics } from './messages';

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

  test('includes the target language in lyrics requests', async () => {
    const sendMessage = vi.fn(() =>
      Promise.resolve({
        status: 'unavailable',
        lines: [],
      }),
    );

    (globalThis as Record<string, unknown>).browser = {
      runtime: {
        sendMessage,
      },
    } as unknown as typeof browser;

    await requestLyrics(
      {
        title: 'Home Sweet Home',
        artists: ['YUKI'],
      },
      'en-US',
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'lyra:fetchLyrics',
      track: {
        title: 'Home Sweet Home',
        artists: ['YUKI'],
      },
      targetLanguage: 'en-US',
    });
  });

  test('includes Spotify lyric lines in translation requests', async () => {
    const sendMessage = vi.fn(() =>
      Promise.resolve({
        status: 'bilingual',
        source: 'spotify',
        lines: [
          {
            timeMs: 0,
            original: 'Hello',
            translated: '你好',
            translatedLanguage: 'zh-CN',
          },
        ],
      }),
    );

    (globalThis as Record<string, unknown>).browser = {
      runtime: {
        sendMessage,
      },
    } as unknown as typeof browser;

    await requestTranslatedLyrics(
      [{ timeMs: 0, original: 'Hello' }],
      'zh-CN',
      'spotify',
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'lyra:translateLyrics',
      lines: [{ timeMs: 0, original: 'Hello' }],
      targetLanguage: 'zh-CN',
      source: 'spotify',
    });
  });
});
