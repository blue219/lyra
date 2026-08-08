import { afterEach, describe, expect, test, vi } from 'vitest';

import { lyricsCacheV2StorageKey } from '@/src/domain/cache';
import type { LyricsResult } from '@/src/domain/model';
import { createLyricsCacheController } from './cache-controller';

const track = { title: 'Song', artists: ['Artist'], durationSeconds: 180 };
const original: LyricsResult = {
  status: 'available',
  source: 'lrclib',
  lines: [{ timeMs: 0, original: 'Hello' }],
};

function createStorage() {
  const values: Record<string, unknown> = {};
  return {
    values,
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values, items);
    }),
    remove: vi.fn(async (key: string | string[]) => {
      for (const item of Array.isArray(key) ? key : [key]) delete values[item];
    }),
  };
}

function createController(overrides: Record<string, unknown> = {}) {
  const storage = createStorage();
  const fetchLyrics = vi.fn(async () => original);
  const translateLyrics = vi.fn(
    async (result: LyricsResult, language?: string) =>
      result.status === 'available'
        ? {
            ...result,
            lines: result.lines.map((line) => ({
              ...line,
              translated: language === 'fr-FR' ? 'Bonjour' : 'Hola',
              translatedLanguage: language,
            })),
          }
        : result,
  );
  const controller = createLyricsCacheController({
    hitTtlMs: 30_000,
    missTtlMs: 5_000,
    degradedTtlMs: 2_000,
    transientMissTtlMs: 1_000,
    maxEntries: 200,
    getStorage: () => storage,
    fetchLyrics,
    translateLyrics,
    ...overrides,
  });
  return { controller, fetchLyrics, storage, translateLyrics };
}

afterEach(() => vi.useRealTimers());

describe('lyrics cache controller V2', () => {
  test('shares one in-flight request and groups structured entries by song', async () => {
    const { controller, fetchLyrics } = createController();
    const [first, second] = await Promise.all([
      controller.handleFetchLyrics(track, 'fr-FR'),
      controller.handleFetchLyrics(track, 'fr-FR'),
    ]);
    expect(first).toEqual(second);
    expect(fetchLyrics).toHaveBeenCalledOnce();

    await controller.handleFetchLyrics(track, 'es-ES');
    await expect(controller.getCacheSummary()).resolves.toMatchObject({
      songCount: 1,
      entryCount: 3,
      maxEntries: 200,
    });
  });

  test('clear aborts stale work and stale completion cannot repopulate V2', async () => {
    let resolveFetch!: (value: LyricsResult) => void;
    const fetchLyrics = vi.fn(
      () => new Promise<LyricsResult>((resolve) => (resolveFetch = resolve)),
    );
    const { controller, storage } = createController({ fetchLyrics });
    const pending = controller.handleFetchLyrics(track);
    await vi.waitFor(() => expect(fetchLyrics).toHaveBeenCalledOnce());

    const clearing = controller.clearCache();
    resolveFetch(original);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await clearing;
    expect(storage.values[lyricsCacheV2StorageKey]).toEqual([]);
    await expect(controller.getCacheSummary()).resolves.toMatchObject({
      songCount: 0,
      entryCount: 0,
    });
  });

  test('complete flow timeout becomes a transient unavailable result', async () => {
    vi.useFakeTimers();
    const fetchLyrics = vi.fn(
      (_track, signal: AbortSignal) =>
        new Promise<LyricsResult>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          }),
        ),
    );
    const { controller } = createController({
      fetchLyrics,
      clock: {
        now: () => Date.now(),
        setTimeout: (callback: () => void, delayMs: number) =>
          setTimeout(callback, delayMs),
        clearTimeout: (handle: ReturnType<typeof setTimeout>) =>
          clearTimeout(handle),
      },
    });
    const pending = controller.handleFetchLyrics(track);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchLyrics).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(25_000);
    await expect(pending).resolves.toEqual({
      status: 'unavailable',
      reason: 'timeout',
      lines: [],
    });
  });

  test('hydrates only live V2 entries and removes the legacy cache', async () => {
    const storage = createStorage();
    storage.values[lyricsCacheV2StorageKey] = [
      {
        version: 2,
        id: 'valid',
        songKey: 'song',
        source: 'lrclib',
        targetLanguage: null,
        expiresAt: 100,
        lastAccessedAt: 0,
        result: original,
      },
      { version: 1 },
      null,
    ];
    const controller = createLyricsCacheController({
      hitTtlMs: 100,
      missTtlMs: 100,
      degradedTtlMs: 100,
      transientMissTtlMs: 100,
      maxEntries: 200,
      getStorage: () => storage,
      fetchLyrics: vi.fn(),
      translateLyrics: vi.fn(),
      clock: {
        now: () => 10,
        setTimeout,
        clearTimeout,
      },
    });
    await expect(controller.getCacheSummary()).resolves.toMatchObject({
      songCount: 1,
      entryCount: 1,
    });
    expect(storage.remove).toHaveBeenCalledWith('lyricsCache');
  });

  test('continues with memory cache when hydration or persistence fails', async () => {
    const logger = { log: vi.fn(), warn: vi.fn() };
    const failingStorage = createStorage();
    failingStorage.get.mockRejectedValueOnce(new Error('read failed'));
    failingStorage.set.mockRejectedValue(new Error('write failed'));
    const controller = createLyricsCacheController({
      hitTtlMs: 100,
      missTtlMs: 100,
      degradedTtlMs: 100,
      transientMissTtlMs: 100,
      maxEntries: 200,
      getStorage: () => failingStorage,
      fetchLyrics: vi.fn().mockResolvedValue(original),
      translateLyrics: vi.fn(),
      logger,
    });
    await expect(controller.handleFetchLyrics(track)).resolves.toEqual(
      original,
    );
    expect(logger.warn).toHaveBeenCalled();
    await expect(controller.handleFetchLyrics(track)).resolves.toEqual(
      original,
    );
  });

  test('works without extension storage and translates Spotify lines', async () => {
    const translateLyrics = vi.fn(async (value: LyricsResult) => value);
    const controller = createLyricsCacheController({
      hitTtlMs: 100,
      missTtlMs: 100,
      degradedTtlMs: 100,
      transientMissTtlMs: 100,
      maxEntries: 200,
      getStorage: () => null,
      fetchLyrics: vi.fn().mockResolvedValue(original),
      translateLyrics,
    });
    await expect(
      controller.handleTranslateLyrics({
        type: 'lyra:translateLyrics',
        source: 'spotify',
        targetLanguage: 'fr-FR',
        lines: [{ timeMs: 0, original: 'Hello' }],
      }),
    ).resolves.toMatchObject({ status: 'available', source: 'spotify' });
    expect(translateLyrics).toHaveBeenCalledOnce();
  });

  test('does not translate unavailable or untargeted originals', async () => {
    const unavailable: LyricsResult = {
      status: 'unavailable',
      reason: 'not-found',
      lines: [],
    };
    const translateLyrics = vi.fn();
    const controller = createLyricsCacheController({
      hitTtlMs: 100,
      missTtlMs: 100,
      degradedTtlMs: 100,
      transientMissTtlMs: 100,
      maxEntries: 200,
      getStorage: () => null,
      fetchLyrics: vi.fn().mockResolvedValue(unavailable),
      translateLyrics,
    });
    await expect(controller.handleFetchLyrics(track, 'fr-FR')).resolves.toBe(
      unavailable,
    );
    expect(translateLyrics).not.toHaveBeenCalled();
  });
});
