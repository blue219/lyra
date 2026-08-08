import type { LyricsCacheEntryV2 } from '@/src/domain/cache';
import type { LyricsResult } from '@/src/domain/model';

export class LyricsCache {
  private readonly entries = new Map<string, LyricsCacheEntryV2>();

  constructor(private readonly maxEntries: number) {}

  get(id: string, nowMs: number): LyricsResult | null {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (isExpired(entry, nowMs)) {
      this.entries.delete(id);
      return null;
    }

    const touched = { ...entry, lastAccessedAt: nowMs };
    this.entries.delete(id);
    this.entries.set(id, touched);
    return touched.result;
  }

  set(entry: LyricsCacheEntryV2): void {
    this.entries.delete(entry.id);
    this.entries.set(entry.id, entry);
    while (this.entries.size > this.maxEntries) {
      const oldestId = this.entries.keys().next().value as string | undefined;
      if (!oldestId) break;
      this.entries.delete(oldestId);
    }
  }

  restore(entry: LyricsCacheEntryV2, nowMs: number): boolean {
    if (isExpired(entry, nowMs)) return false;
    this.set(entry);
    return true;
  }

  getEntries(nowMs: number): LyricsCacheEntryV2[] {
    for (const [id, entry] of this.entries) {
      if (isExpired(entry, nowMs)) this.entries.delete(id);
    }
    return [...this.entries.values()];
  }

  clear(): void {
    this.entries.clear();
  }
}

function isExpired(entry: LyricsCacheEntryV2, nowMs: number): boolean {
  return entry.expiresAt !== null && entry.expiresAt <= nowMs;
}
