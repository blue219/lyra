import {
  legacyLyricsCacheStorageKey,
  lyricsCacheV2StorageKey,
  type LyricsCacheEntryV2,
} from '@/src/domain/cache';
import { normalizeTrackIdentity } from '@/src/domain/track';
import type {
  CacheSummary,
  LyricsResult,
  LyricsSource,
  TrackIdentity,
} from '@/src/domain/model';
import type { TranslateLyricsRequest } from '@/src/ports/runtime';
import type { KeyValueStorage } from '@/src/ports/storage';
import { systemClock, type Clock } from '@/src/ports/clock';
import { createAttemptSignal, lyricsFlowTimeoutMs } from './abort';
import {
  createFallbackCacheIdentity,
  createSpotifyLyricsCacheIdentity,
  type CacheIdentity,
} from './cache-key';
import { LyricsCache } from './cache';

interface LyricsCacheControllerOptions {
  hitTtlMs: number;
  missTtlMs: number;
  degradedTtlMs: number;
  transientMissTtlMs: number;
  maxEntries: number;
  getStorage: () => KeyValueStorage | null | undefined;
  fetchLyrics: (
    track: TrackIdentity,
    signal: AbortSignal,
  ) => Promise<LyricsResult>;
  translateLyrics: (
    result: LyricsResult,
    targetLanguage: string | undefined,
    signal: AbortSignal,
  ) => Promise<LyricsResult>;
  clock?: Clock;
  logger?: Pick<Console, 'log' | 'warn'>;
}

interface InFlightRequest {
  songKey: string;
  generation: number;
  controller: AbortController;
  promise: Promise<LyricsResult>;
}

export interface LyricsCacheController {
  handleFetchLyrics(
    track: TrackIdentity,
    targetLanguage?: string,
  ): Promise<LyricsResult>;
  handleTranslateLyrics(message: TranslateLyricsRequest): Promise<LyricsResult>;
  getCacheSummary(): Promise<CacheSummary>;
  clearCache(): Promise<void>;
}

export function createLyricsCacheController(
  options: LyricsCacheControllerOptions,
): LyricsCacheController {
  const clock = options.clock ?? systemClock;
  const logger = options.logger ?? console;
  const cache = new LyricsCache(options.maxEntries);
  const inFlight = new Map<string, InFlightRequest>();
  let generation = 0;
  let persistenceQueue: Promise<void> = Promise.resolve();
  const hydrationPromise = hydrate();

  async function hydrate(): Promise<void> {
    const storage = options.getStorage();
    if (!storage) return;

    try {
      const stored = await storage.get(lyricsCacheV2StorageKey);
      const entries = stored[lyricsCacheV2StorageKey];
      if (Array.isArray(entries)) {
        const now = clock.now();
        for (const value of entries) {
          if (isLyricsCacheEntryV2(value)) cache.restore(value, now);
        }
      }
      await storage.remove(legacyLyricsCacheStorageKey);
    } catch (error) {
      logger.warn('[Lyra] Failed to hydrate lyrics cache V2:', error);
    }
  }

  function queuePersist(
    entries: LyricsCacheEntryV2[],
    writeGeneration: number,
  ): Promise<void> {
    const storage = options.getStorage();
    if (!storage) return Promise.resolve();

    const write = persistenceQueue
      .catch(() => undefined)
      .then(async () => {
        if (writeGeneration !== generation) return;
        await storage.set({ [lyricsCacheV2StorageKey]: entries });
      });
    persistenceQueue = write.catch((error) => {
      logger.warn('[Lyra] Failed to persist lyrics cache V2:', error);
    });
    return write;
  }

  function abortRequestsExcept(songKey: string): void {
    for (const request of inFlight.values()) {
      if (request.songKey !== songKey) {
        request.controller.abort(
          new DOMException('Track changed', 'AbortError'),
        );
      }
    }
  }

  async function getCachedOrLoad({
    identity,
    source,
    targetLanguage,
    load,
    onTimeout,
  }: {
    identity: CacheIdentity;
    source: LyricsSource;
    targetLanguage: string | null;
    load: (signal: AbortSignal) => Promise<LyricsResult>;
    onTimeout: () => LyricsResult;
  }): Promise<LyricsResult> {
    await hydrationPromise;
    const cached = cache.get(identity.id, clock.now());
    if (cached) return cached;

    const existing = inFlight.get(identity.id);
    if (existing) return existing.promise;

    const requestGeneration = generation;
    const controller = new AbortController();
    const flow = createAttemptSignal(
      controller.signal,
      lyricsFlowTimeoutMs,
      clock,
    );

    const promise = load(flow.signal)
      .catch((error: unknown) => {
        if (flow.didTimeout() && !controller.signal.aborted) return onTimeout();
        throw error;
      })
      .then(async (result) => {
        if (requestGeneration !== generation || controller.signal.aborted) {
          throw (
            controller.signal.reason ??
            new DOMException('Stale lyrics request', 'AbortError')
          );
        }

        const now = clock.now();
        cache.set({
          version: 2,
          id: identity.id,
          songKey: identity.songKey,
          source,
          targetLanguage,
          expiresAt: now + getTtl(result),
          lastAccessedAt: now,
          result,
        });
        try {
          await queuePersist(cache.getEntries(now), requestGeneration);
        } catch {
          // Persistence failures must not hide a usable in-memory lyrics result.
        }
        return result;
      })
      .finally(() => {
        flow.dispose();
        if (inFlight.get(identity.id)?.promise === promise) {
          inFlight.delete(identity.id);
        }
      });

    inFlight.set(identity.id, {
      songKey: identity.songKey,
      generation: requestGeneration,
      controller,
      promise,
    });
    return promise;
  }

  function getTtl(result: LyricsResult): number {
    if (result.status === 'unavailable') {
      return isTransientReason(result.reason)
        ? options.transientMissTtlMs
        : options.missTtlMs;
    }
    if (
      result.degradationReason &&
      result.degradationReason !== 'same-language'
    ) {
      return options.degradedTtlMs;
    }
    return options.hitTtlMs;
  }

  async function originalLyrics(track: TrackIdentity): Promise<LyricsResult> {
    const identity = createFallbackCacheIdentity(track, null);
    abortRequestsExcept(identity.songKey);
    return getCachedOrLoad({
      identity,
      source: 'lrclib',
      targetLanguage: null,
      load: (signal) => options.fetchLyrics(track, signal),
      onTimeout: () => unavailable('timeout'),
    });
  }

  return {
    async handleFetchLyrics(track, targetLanguage) {
      const normalizedTrack = normalizeTrackIdentity(track);
      const original = await originalLyrics(normalizedTrack);
      if (original.status === 'unavailable' || !targetLanguage) return original;

      const identity = createFallbackCacheIdentity(
        normalizedTrack,
        targetLanguage,
      );
      return getCachedOrLoad({
        identity,
        source: 'lrclib',
        targetLanguage,
        load: (signal) =>
          options.translateLyrics(original, targetLanguage, signal),
        onTimeout: () => ({
          ...original,
          degradationReason: 'timeout',
        }),
      });
    },

    handleTranslateLyrics(message) {
      const identity = createSpotifyLyricsCacheIdentity(
        message.source,
        message.targetLanguage,
        message.lines,
      );
      abortRequestsExcept(identity.songKey);
      const original: LyricsResult = {
        status: 'available',
        source: message.source,
        lines: message.lines,
      };
      return getCachedOrLoad({
        identity,
        source: message.source,
        targetLanguage: message.targetLanguage ?? null,
        load: (signal) =>
          options.translateLyrics(original, message.targetLanguage, signal),
        onTimeout: () => ({ ...original, degradationReason: 'timeout' }),
      });
    },

    async getCacheSummary() {
      await hydrationPromise;
      const entries = cache.getEntries(clock.now());
      return {
        songCount: new Set(entries.map((entry) => entry.songKey)).size,
        entryCount: entries.length,
        maxEntries: options.maxEntries,
        sizeBytes: new TextEncoder().encode(JSON.stringify(entries)).length,
      };
    },

    async clearCache() {
      await hydrationPromise;
      generation += 1;
      for (const request of inFlight.values()) {
        request.controller.abort(
          new DOMException('Lyrics cache cleared', 'AbortError'),
        );
      }
      inFlight.clear();
      cache.clear();
      await queuePersist([], generation);
      await options.getStorage()?.remove(legacyLyricsCacheStorageKey);
    },
  };
}

function isTransientReason(reason: string): boolean {
  return [
    'network-error',
    'rate-limited',
    'provider-error',
    'invalid-response',
    'timeout',
    'extension-context-invalidated',
  ].includes(reason);
}

function unavailable(reason: 'timeout'): LyricsResult {
  return { status: 'unavailable', reason, lines: [] };
}

function isLyricsCacheEntryV2(value: unknown): value is LyricsCacheEntryV2 {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LyricsCacheEntryV2>;
  return (
    entry.version === 2 &&
    typeof entry.id === 'string' &&
    typeof entry.songKey === 'string' &&
    (entry.source === 'spotify' || entry.source === 'lrclib') &&
    (entry.targetLanguage === null ||
      typeof entry.targetLanguage === 'string') &&
    typeof entry.expiresAt === 'number' &&
    typeof entry.lastAccessedAt === 'number' &&
    Boolean(entry.result) &&
    typeof entry.result === 'object'
  );
}
