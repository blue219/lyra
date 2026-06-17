import { createTrackCacheKey, normalizeTrackIdentity } from '../spotify/track';
import { createSpotifyLyricsCacheKey } from './cache-key';
import { LyricsCache, type CacheEntrySnapshot } from './cache';
import type { TranslateLyricsMessage } from './messages';
import type { LyricsResult, TrackIdentity } from '../../shared/types';

interface LyricsCacheStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface LyricsCacheControllerOptions {
  storageKey: string;
  hitTtlMs: number;
  missTtlMs: number;
  degradedTtlMs: number;
  transientMissTtlMs: number;
  maxEntries: number;
  getStorage: () => LyricsCacheStorage | null | undefined;
  fetchLyrics: (track: TrackIdentity) => Promise<LyricsResult>;
  translateLyrics: (
    result: LyricsResult,
    targetLanguage: string | undefined,
  ) => Promise<LyricsResult>;
  nowMs?: () => number;
  logger?: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
}

export interface LyricsCacheController {
  handleFetchOriginalLyrics(track: TrackIdentity): Promise<LyricsResult>;
  handleFetchLyrics(
    track: TrackIdentity,
    targetLanguage?: string,
  ): Promise<LyricsResult>;
  handleTranslateLyrics(message: TranslateLyricsMessage): Promise<LyricsResult>;
}

export function createLyricsCacheController(
  options: LyricsCacheControllerOptions,
): LyricsCacheController {
  const nowMs = options.nowMs ?? Date.now;
  const logger = options.logger ?? console;
  const cache = new LyricsCache({
    hitTtlMs: options.hitTtlMs,
    missTtlMs: options.missTtlMs,
    maxEntries: options.maxEntries,
  });
  const inFlightRequests = new Map<string, Promise<LyricsResult>>();
  const hydrationPromise = hydrateCacheFromStorage();

  async function hydrateCacheFromStorage(): Promise<void> {
    const storage = options.getStorage();
    if (!storage) return;

    try {
      const result = await storage.get(options.storageKey);
      const entries = result[options.storageKey];

      if (!Array.isArray(entries)) return;

      let loaded = 0;
      const now = nowMs();

      for (const entry of entries) {
        if (!isCacheEntrySnapshot(entry)) continue;
        if (cache.restore(entry.key, entry.value, entry.expiresAt, now)) {
          loaded++;
        }
      }

      if (loaded > 0) {
        logger.log(`[Lyra] Loaded ${loaded} cached lyrics entries from storage`);
      }
    } catch (error) {
      logger.warn('[Lyra] Failed to load lyrics cache from storage:', error);
    }
  }

  async function persistCacheToStorage(): Promise<void> {
    const storage = options.getStorage();
    if (!storage) return;

    try {
      await storage.set({
        [options.storageKey]: cache.getEntries(nowMs()),
      });
    } catch (error) {
      logger.warn('[Lyra] Failed to persist lyrics cache:', error);
    }
  }

  async function getCachedOrLoad(
    cacheKey: string,
    targetLanguage: string | undefined,
    loadLyrics: () => Promise<LyricsResult>,
  ): Promise<LyricsResult> {
    await hydrationPromise;

    const cached = cache.get(cacheKey, nowMs());

    if (cached) {
      return cached;
    }

    const inFlightRequest = inFlightRequests.get(cacheKey);

    if (inFlightRequest) {
      return inFlightRequest;
    }

    const nextRequest = loadLyrics()
      .then(async (lyrics) => {
        cache.set(cacheKey, lyrics, nowMs(), getResultTtlMs(lyrics, targetLanguage));
        await persistCacheToStorage();
        return lyrics;
      })
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });

    inFlightRequests.set(cacheKey, nextRequest);
    return nextRequest;
  }

  function getResultTtlMs(
    lyrics: LyricsResult,
    targetLanguage: string | undefined,
  ): number | undefined {
    if (lyrics.status === 'unavailable') {
      return getUnavailableTtlMs(lyrics);
    }

    if (
      lyrics.status === 'monolingual' &&
      targetLanguage &&
      lyrics.sourceLanguage !== targetLanguage
    ) {
      return options.degradedTtlMs;
    }

    return options.hitTtlMs;
  }

  function getUnavailableTtlMs(lyrics: LyricsResult): number {
    if (
      lyrics.unavailableReason === 'network-error' ||
      lyrics.unavailableReason === 'rate-limited' ||
      lyrics.unavailableReason === 'provider-error' ||
      lyrics.unavailableReason === 'invalid-response' ||
      lyrics.unavailableReason === 'extension-context-invalidated'
    ) {
      return options.transientMissTtlMs;
    }

    return options.missTtlMs;
  }

  function loadOriginalFallbackLyrics(normalizedTrack: TrackIdentity): Promise<LyricsResult> {
    const cacheKey = ['fallback-original', createTrackCacheKey(normalizedTrack)].join('__');

    return getCachedOrLoad(cacheKey, undefined, async () => {
      const lyrics = await options.fetchLyrics(normalizedTrack);

      logger.log('[Lyra] bg original fallback lyrics result:', lyrics.status, lyrics.lines.length);
      return lyrics;
    });
  }

  async function loadTranslatedFallbackLyrics(
    normalizedTrack: TrackIdentity,
    targetLanguage: string,
  ): Promise<LyricsResult> {
    const originalLyrics = await loadOriginalFallbackLyrics(normalizedTrack);

    if (originalLyrics.status === 'unavailable') {
      return originalLyrics;
    }

    const cacheKey = [
      'fallback-translated',
      createTrackCacheKey(normalizedTrack),
      targetLanguage,
    ].join('__');

    return getCachedOrLoad(cacheKey, targetLanguage, async () => {
      const lyrics = await options.translateLyrics(originalLyrics, targetLanguage);

      logger.log('[Lyra] bg fallback lyrics result:', lyrics.status, lyrics.lines.length);
      return lyrics;
    });
  }

  return {
    handleFetchOriginalLyrics(track: TrackIdentity): Promise<LyricsResult> {
      const normalizedTrack = normalizeTrackIdentity(track);

      return loadOriginalFallbackLyrics(normalizedTrack);
    },

    handleFetchLyrics(
      track: TrackIdentity,
      targetLanguage?: string,
    ): Promise<LyricsResult> {
      const normalizedTrack = normalizeTrackIdentity(track);

      if (!targetLanguage) {
        return loadOriginalFallbackLyrics(normalizedTrack);
      }

      return loadTranslatedFallbackLyrics(normalizedTrack, targetLanguage);
    },

    handleTranslateLyrics(message: TranslateLyricsMessage): Promise<LyricsResult> {
      const cacheKey = createSpotifyLyricsCacheKey(
        message.source,
        message.targetLanguage,
        message.lines,
      );

      return getCachedOrLoad(cacheKey, message.targetLanguage, async () => {
        const lyrics = await options.translateLyrics(
          {
            status: 'monolingual',
            lines: message.lines,
            source: message.source,
          },
          message.targetLanguage,
        );

        logger.log('[Lyra] bg translated lyrics result:', lyrics.status, lyrics.lines.length);
        return lyrics;
      });
    },
  };
}

function isCacheEntrySnapshot(value: unknown): value is CacheEntrySnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<CacheEntrySnapshot>;

  return (
    typeof entry.key === 'string' &&
    typeof entry.expiresAt === 'number' &&
    Boolean(entry.value) &&
    typeof entry.value === 'object'
  );
}
