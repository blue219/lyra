import { describe, expect, test, vi } from 'vitest';

import {
  createRuntimeClient,
  createRuntimeHandlerRegistry,
  isRuntimeRequest,
} from './runtime';

const track = { title: 'Song', artists: ['Artist'], durationSeconds: 180 };

describe('runtime protocol', () => {
  test('validates complete nested requests and rejects extra keys', () => {
    expect(
      isRuntimeRequest({
        type: 'lyra:fetchLyrics',
        track,
        targetLanguage: 'fr-FR',
      }),
    ).toBe(true);
    expect(
      isRuntimeRequest({ type: 'lyra:fetchLyrics', track: { title: 'Song' } }),
    ).toBe(false);
    expect(
      isRuntimeRequest({
        type: 'lyra:translateLyrics',
        source: 'spotify',
        lines: [{ timeMs: 0, original: 'Hello', nested: true }],
      }),
    ).toBe(false);
    expect(
      isRuntimeRequest({ type: 'lyra:clearLyricsCache', unexpected: true }),
    ).toBe(false);
  });

  test('typed client rejects malformed responses', async () => {
    const client = createRuntimeClient({
      sendMessage: vi
        .fn()
        .mockResolvedValue({ status: 'available', lines: [] }),
    });
    await expect(
      client.send<'lyra:fetchLyrics'>({ type: 'lyra:fetchLyrics', track }),
    ).rejects.toThrow('Invalid runtime response');
  });

  test('handler registry dispatches only validated requests', async () => {
    const fetchHandler = vi.fn().mockResolvedValue({
      status: 'unavailable',
      reason: 'not-found',
      lines: [],
    });
    const registry = createRuntimeHandlerRegistry({
      'lyra:fetchLyrics': fetchHandler,
      'lyra:translateLyrics': vi.fn(),
      'lyra:getLyricsCacheSummary': vi.fn(),
      'lyra:clearLyricsCache': vi.fn(),
    });

    expect(registry({ type: 'lyra:fetchLyrics', track: {} })).toBeUndefined();
    await expect(
      registry({ type: 'lyra:fetchLyrics', track }),
    ).resolves.toMatchObject({
      reason: 'not-found',
    });
    expect(fetchHandler).toHaveBeenCalledOnce();
  });

  test('keeps the Chrome callback channel open for asynchronous handlers', async () => {
    const sendResponse = vi.fn();
    const registry = createRuntimeHandlerRegistry({
      'lyra:fetchLyrics': vi.fn().mockResolvedValue({
        status: 'unavailable',
        reason: 'not-found',
        lines: [],
      }),
      'lyra:translateLyrics': vi.fn(),
      'lyra:getLyricsCacheSummary': vi.fn(),
      'lyra:clearLyricsCache': vi.fn(),
    });
    expect(
      registry({ type: 'lyra:fetchLyrics', track }, {}, sendResponse),
    ).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledOnce());
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'not-found' }),
    );
  });

  test('serializes rejected callback handlers for the typed client', async () => {
    const sendResponse = vi.fn();
    const registry = createRuntimeHandlerRegistry({
      'lyra:fetchLyrics': vi.fn().mockRejectedValue(new Error('failed')),
      'lyra:translateLyrics': vi.fn(),
      'lyra:getLyricsCacheSummary': vi.fn(),
      'lyra:clearLyricsCache': vi.fn(),
    });
    expect(
      registry({ type: 'lyra:fetchLyrics', track }, {}, sendResponse),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        __lyraRuntimeError: 'failed',
      }),
    );
    const client = createRuntimeClient({
      sendMessage: vi.fn().mockResolvedValue({ __lyraRuntimeError: 'failed' }),
    });
    await expect(
      client.send<'lyra:fetchLyrics'>({ type: 'lyra:fetchLyrics', track }),
    ).rejects.toThrow('failed');
  });
});
