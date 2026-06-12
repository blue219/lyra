import { LyricsCache } from '../src/lib/cache';
import { getExtensionApi } from '../src/lib/extension-api';
import { fetchLyricsFromLrclib } from '../src/lib/lrclib';
import {
  isFetchLyricsMessage,
  isTranslateLyricsMessage,
  type TranslateLyricsMessage,
} from '../src/lib/messages';
import { translateLyricsResult } from '../src/lib/translate';
import { createTrackCacheKey, normalizeTrackIdentity } from '../src/lib/track';
import type { LyricsResult, TrackIdentity } from '../src/lib/types';

const lyricsCache = new LyricsCache({
  hitTtlMs: 1000 * 60 * 30,
  missTtlMs: 1000 * 60 * 5,
});

export default defineBackground(() => {
  const extensionApi = getExtensionApi();

  extensionApi?.runtime?.onMessage.addListener((message) => {
    if (isFetchLyricsMessage(message)) {
      return handleFetchLyrics(message.track, message.targetLanguage);
    }

    if (isTranslateLyricsMessage(message)) {
      return handleTranslateLyrics(message);
    }

    return undefined;
  });
});

async function handleFetchLyrics(
  track: TrackIdentity,
  targetLanguage?: string,
): Promise<LyricsResult> {
  const normalizedTrack = normalizeTrackIdentity(track);
  const cacheKey = ['fallback', createTrackCacheKey(normalizedTrack), targetLanguage ?? ''].join(
    '__',
  );
  const cached = lyricsCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const lyrics = await translateLyricsResult(
    await fetchLyricsFromLrclib(normalizedTrack),
    targetLanguage,
  );

  console.log('[Lyra] bg fallback lyrics result:', lyrics.status, lyrics.lines.length);
  lyricsCache.set(cacheKey, lyrics);
  return lyrics;
}

async function handleTranslateLyrics(
  message: TranslateLyricsMessage,
): Promise<LyricsResult> {
  const cacheKey = [
    message.source ?? 'spotify',
    message.targetLanguage ?? '',
    message.sourceLanguage ?? '',
    message.lines.map((line) => line.original).join('\n'),
  ].join('__');
  const cached = lyricsCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const lyrics = await translateLyricsResult(
    {
      status: 'monolingual',
      lines: message.lines,
      sourceLanguage: message.sourceLanguage,
      source: message.source,
    },
    message.targetLanguage,
  );

  console.log('[Lyra] bg translated lyrics result:', lyrics.status, lyrics.lines.length);
  lyricsCache.set(cacheKey, lyrics);
  return lyrics;
}
