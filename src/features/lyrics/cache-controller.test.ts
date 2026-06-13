import { describe, expect, test, vi } from 'vitest';

import { createLyricsCacheController } from './cache-controller';
import type { CacheEntrySnapshot } from './cache';
import type { LyricsResult, TrackIdentity } from '../../shared/types';

const storageKey = 'lyricsCache';
const track: TrackIdentity = {
  title: 'Home Sweet Home',
  artists: ['YUKI'],
};

const originalLine = { timeMs: 0, original: 'Hello' };
const bilingualResult: LyricsResult = {
  status: 'bilingual',
  source: 'spotify',
  sourceLanguage: 'en-US',
  lines: [
    {
      ...originalLine,
      translated: '你好',
      translatedLanguage: 'zh-CN',
    },
  ],
};
const monolingualResult: LyricsResult = {
  status: 'monolingual',
  source: 'spotify',
  sourceLanguage: 'en-US',
  lines: [originalLine],
};
const unavailableResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

describe('createLyricsCacheController', () => {
  test('hydrates unexpired entries and skips expired entries', async () => {
    const storage = createStorage([
      {
        key: 'spotify__zh-CN__Hello',
        expiresAt: 10_000,
        value: bilingualResult,
      },
      {
        key: 'spotify__zh-CN__Expired',
        expiresAt: 1_000,
        value: bilingualResult,
      },
    ]);
    const translateLyrics = vi.fn(async (result: LyricsResult) => ({
      ...result,
      sourceLanguage: 'en-US',
    }));
    const controller = createController({
      storage,
      translateLyrics,
      nowMs: () => 5_000,
    });

    await expect(
      controller.handleTranslateLyrics({
        type: 'lyra:translateLyrics',
        lines: [originalLine],
        targetLanguage: 'zh-CN',
        source: 'spotify',
      }),
    ).resolves.toEqual(bilingualResult);
    expect(translateLyrics).not.toHaveBeenCalled();

    await controller.handleTranslateLyrics({
      type: 'lyra:translateLyrics',
      lines: [{ timeMs: 0, original: 'Expired' }],
      targetLanguage: 'zh-CN',
      source: 'spotify',
    });

    expect(translateLyrics).toHaveBeenCalledTimes(1);
  });

  test('waits for hydration before checking the first request cache hit', async () => {
    const hydration = createDeferred<Record<string, unknown>>();
    const storage = createStorage();
    storage.area.get.mockReturnValue(hydration.promise);
    const translateLyrics = vi.fn(async () => monolingualResult);
    const controller = createController({
      storage,
      translateLyrics,
      nowMs: () => 5_000,
    });

    const request = controller.handleTranslateLyrics({
      type: 'lyra:translateLyrics',
      lines: [originalLine],
      targetLanguage: 'zh-CN',
      source: 'spotify',
    });

    await Promise.resolve();
    expect(translateLyrics).not.toHaveBeenCalled();

    hydration.resolve({
      [storageKey]: [
        {
          key: 'spotify__zh-CN__Hello',
          expiresAt: 10_000,
          value: bilingualResult,
        },
      ],
    });

    await expect(request).resolves.toEqual(bilingualResult);
    expect(translateLyrics).not.toHaveBeenCalled();
  });

  test('serves repeated fallback requests from cache without refetching', async () => {
    const storage = createStorage();
    const fetchLyrics = vi.fn(async () => monolingualResult);
    const translateLyrics = vi.fn(async () => bilingualResult);
    const controller = createController({
      storage,
      fetchLyrics,
      translateLyrics,
    });

    await controller.handleFetchLyrics(track, 'zh-CN');
    await controller.handleFetchLyrics(track, 'zh-CN');

    expect(fetchLyrics).toHaveBeenCalledTimes(1);
    expect(translateLyrics).toHaveBeenCalledTimes(1);
  });

  test('returns untranslated fallback lyrics without triggering translation', async () => {
    const storage = createStorage();
    const fetchLyrics = vi.fn(async (): Promise<LyricsResult> => ({
      status: 'monolingual',
      source: 'lrclib',
      lines: [{ timeMs: 0, original: 'Hello' }],
    }));
    const translateLyrics = vi.fn(async () => bilingualResult);
    const controller = createController({
      storage,
      fetchLyrics,
      translateLyrics,
    });

    await expect(controller.handleFetchOriginalLyrics(track)).resolves.toEqual({
      status: 'monolingual',
      source: 'lrclib',
      lines: [{ timeMs: 0, original: 'Hello' }],
    });
    expect(fetchLyrics).toHaveBeenCalledTimes(1);
    expect(translateLyrics).not.toHaveBeenCalled();
  });

  test('deduplicates concurrent requests for the same cache key', async () => {
    const storage = createStorage();
    const translation = createDeferred<LyricsResult>();
    const translateLyrics = vi.fn(() => translation.promise);
    const controller = createController({
      storage,
      translateLyrics,
    });

    const firstRequest = controller.handleTranslateLyrics({
      type: 'lyra:translateLyrics',
      lines: [originalLine],
      targetLanguage: 'zh-CN',
      source: 'spotify',
    });
    const secondRequest = controller.handleTranslateLyrics({
      type: 'lyra:translateLyrics',
      lines: [originalLine],
      targetLanguage: 'zh-CN',
      source: 'spotify',
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(translateLyrics).toHaveBeenCalledTimes(1);

    translation.resolve(bilingualResult);

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      bilingualResult,
      bilingualResult,
    ]);
  });

  test('uses distinct ttls for hits, misses, same-language monolingual, and degraded monolingual results', async () => {
    let nowMs = 1_000;
    const storage = createStorage();
    const translateLyrics = vi.fn(async (result: LyricsResult): Promise<LyricsResult> => {
      const original = result.lines[0]?.original;

      if (original === 'Bilingual') {
        return { ...bilingualResult, lines: [{ timeMs: 0, original }] };
      }

      if (original === 'Unavailable') {
        return unavailableResult;
      }

      if (original === 'Same language') {
        return {
          status: 'monolingual',
          source: 'spotify',
          sourceLanguage: 'zh-CN',
          lines: [{ timeMs: 0, original }],
        };
      }

      return {
        status: 'monolingual',
        source: 'spotify',
        sourceLanguage: 'en-US',
        lines: [{ timeMs: 0, original: original ?? '' }],
      };
    });
    const controller = createController({
      storage,
      translateLyrics,
      nowMs: () => nowMs,
    });

    for (const original of ['Bilingual', 'Unavailable', 'Same language', 'Degraded']) {
      await controller.handleTranslateLyrics({
        type: 'lyra:translateLyrics',
        lines: [{ timeMs: 0, original }],
        targetLanguage: 'zh-CN',
        source: 'spotify',
      });
      nowMs += 100;
    }

    expect(getExpiresAt(storage, 'spotify__zh-CN__Bilingual')).toBe(31_000);
    expect(getExpiresAt(storage, 'spotify__zh-CN__Unavailable')).toBe(6_100);
    expect(getExpiresAt(storage, 'spotify__zh-CN__Same language')).toBe(31_200);
    expect(getExpiresAt(storage, 'spotify__zh-CN__Degraded')).toBe(3_300);
  });

  test('returns lyrics when persistence fails', async () => {
    const storage = createStorage();
    storage.area.set.mockRejectedValue(new Error('quota exceeded'));
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
    };
    const controller = createController({
      storage,
      logger,
      translateLyrics: vi.fn(async () => bilingualResult),
    });

    await expect(
      controller.handleTranslateLyrics({
        type: 'lyra:translateLyrics',
        lines: [originalLine],
        targetLanguage: 'zh-CN',
        source: 'spotify',
      }),
    ).resolves.toEqual(bilingualResult);
    expect(logger.warn).toHaveBeenCalledWith(
      '[Lyra] Failed to persist lyrics cache:',
      expect.any(Error),
    );
  });
});

function createController({
  storage = createStorage(),
  fetchLyrics = vi.fn(async () => monolingualResult),
  translateLyrics = vi.fn(async () => bilingualResult),
  nowMs = () => 1_000,
  logger = { log: vi.fn(), warn: vi.fn() },
}: {
  storage?: ReturnType<typeof createStorage>;
  fetchLyrics?: (track: TrackIdentity) => Promise<LyricsResult>;
  translateLyrics?: (
    result: LyricsResult,
    targetLanguage: string | undefined,
  ) => Promise<LyricsResult>;
  nowMs?: () => number;
  logger?: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
} = {}) {
  return createLyricsCacheController({
    storageKey,
    hitTtlMs: 30_000,
    missTtlMs: 5_000,
    degradedTtlMs: 2_000,
    maxEntries: 200,
    getStorage: () => storage.area,
    fetchLyrics,
    translateLyrics,
    nowMs,
    logger,
  });
}

function createStorage(entries: CacheEntrySnapshot[] = []) {
  const state: Record<string, unknown> = {
    [storageKey]: entries,
  };
  const area = {
    get: vi.fn(async (key: string) => ({
      [key]: state[key],
    })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(state, items);
    }),
  };

  return { area, state };
}

function getExpiresAt(storage: ReturnType<typeof createStorage>, key: string): number {
  const entries = storage.state[storageKey] as CacheEntrySnapshot[];
  const entry = entries.find((item) => item.key === key);

  if (!entry) {
    throw new Error(`Missing cache entry: ${key}`);
  }

  return entry.expiresAt;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
