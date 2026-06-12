import type { LyricsResult } from '../../shared/types';

interface LyricsCacheOptions {
  hitTtlMs: number;
  missTtlMs: number;
}

interface CacheEntry {
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

    return entry.value;
  }

  set(key: string, value: LyricsResult, nowMs = Date.now()): void {
    const ttlMs =
      value.status === 'unavailable'
        ? this.options.missTtlMs
        : this.options.hitTtlMs;

    this.entries.set(key, {
      value,
      expiresAt: nowMs + ttlMs,
    });
  }
}
