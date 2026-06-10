import { LyricsCache } from '../src/lib/cache';
import { getExtensionApi } from '../src/lib/extension-api';
import { fetchLyricsFromLrclib } from '../src/lib/lrclib';
import { isFetchLyricsMessage } from '../src/lib/messages';
import { createTrackCacheKey, normalizeTrackIdentity } from '../src/lib/track';

const lyricsCache = new LyricsCache({
  hitTtlMs: 1000 * 60 * 30,
  missTtlMs: 1000 * 60 * 5,
});

export default defineBackground(() => {
  const extensionApi = getExtensionApi();

  extensionApi?.runtime?.onMessage.addListener((message) => {
    if (!isFetchLyricsMessage(message)) {
      return undefined;
    }

    return handleFetchLyrics(message.track);
  });
});

async function handleFetchLyrics(track: {
  title: string;
  artists: string[];
  album?: string;
}) {
  const normalizedTrack = normalizeTrackIdentity(track);
  const cacheKey = createTrackCacheKey(normalizedTrack);
  const cached = lyricsCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const lyrics = await fetchLyricsFromLrclib(normalizedTrack);
  lyricsCache.set(cacheKey, lyrics);
  return lyrics;
}
