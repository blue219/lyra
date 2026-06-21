import type { LyricsResult } from '../../shared/types';

interface LyricsCacheOptions {
  hitTtlMs: number;
  missTtlMs: number;
  maxEntries: number;
}

interface CacheEntry {
  expiresAt: number;
  value: LyricsResult;
}

export interface CacheEntrySnapshot {
  key: string;
  expiresAt: number;
  value: LyricsResult;
}

export class LyricsCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly options: LyricsCacheOptions) {}

  get(key: string, nowMs = Date.now()): LyricsResult | null {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= nowMs) {
      this.entries.delete(key);
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.value;
  }

  set(
    key: string,
    value: LyricsResult,
    nowMs = Date.now(),
    ttlMsOverride?: number,
  ): void {
    const ttlMs =
      ttlMsOverride ??
      (value.status === 'unavailable'
        ? this.options.missTtlMs
        : this.options.hitTtlMs);

    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: nowMs + ttlMs,
    });
    this.enforceMaxEntries();
  }

  getEntries(nowMs = Date.now()): CacheEntrySnapshot[] {
    this.removeExpiredEntries(nowMs);

    return Array.from(this.entries, ([key, entry]) => ({
      key,
      expiresAt: entry.expiresAt,
      value: entry.value,
    }));
  }

  clear(): void {
    this.entries.clear();
  }

  /** Hydrate an entry with a pre-computed expiresAt (for persistence restore). */
  restore(
    key: string,
    value: LyricsResult,
    expiresAt: number,
    nowMs = Date.now(),
  ): boolean {
    if (!key || !value || expiresAt <= nowMs) {
      return false;
    }

    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt });
    this.enforceMaxEntries();

    return true;
  }

  private enforceMaxEntries(): void {
    while (this.entries.size > this.options.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;

      if (!oldestKey) {
        return;
      }

      this.entries.delete(oldestKey);
    }
  }

  private removeExpiredEntries(nowMs: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= nowMs) {
        this.entries.delete(key);
      }
    }
  }
}
