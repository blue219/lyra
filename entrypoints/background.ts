import { createToolbarActionGate } from '../src/features/action/action-gate';
import { createLyricsCacheController } from '../src/features/lyrics/cache-controller';
import { fetchLyricsFromLrclib } from '../src/features/lyrics/lrclib';
import {
  isFetchLyricsMessage,
  isFetchOriginalLyricsMessage,
  isTranslateLyricsMessage,
} from '../src/features/lyrics/messages';
import { translateLyricsResult } from '../src/features/translation/translate';
import { getExtensionApi } from '../src/shared/extension-api';

const CACHE_STORAGE_KEY = 'lyricsCache';
const MAX_CACHE_ENTRIES = 200;
const HIT_TTL_MS = 1000 * 60 * 30;
const MISS_TTL_MS = 1000 * 60 * 5;
const DEGRADED_TTL_MS = 1000 * 60 * 2;
const TRANSIENT_MISS_TTL_MS = 1000 * 60;

const lyricsCacheController = createLyricsCacheController({
  storageKey: CACHE_STORAGE_KEY,
  hitTtlMs: HIT_TTL_MS,
  missTtlMs: MISS_TTL_MS,
  degradedTtlMs: DEGRADED_TTL_MS,
  transientMissTtlMs: TRANSIENT_MISS_TTL_MS,
  maxEntries: MAX_CACHE_ENTRIES,
  getStorage: () => getExtensionApi()?.storage?.local,
  fetchLyrics: fetchLyricsFromLrclib,
  translateLyrics: translateLyricsResult,
});

export default defineBackground(() => {
  const extensionApi = getExtensionApi();

  if (extensionApi?.action && extensionApi.declarativeContent) {
    void createToolbarActionGate({
      action: extensionApi.action,
      declarativeContent: extensionApi.declarativeContent,
    }).start();
  }

  extensionApi?.runtime?.onMessage.addListener((message) => {
    if (isFetchOriginalLyricsMessage(message)) {
      return lyricsCacheController.handleFetchOriginalLyrics(message.track);
    }

    if (isFetchLyricsMessage(message)) {
      return lyricsCacheController.handleFetchLyrics(message.track, message.targetLanguage);
    }

    if (isTranslateLyricsMessage(message)) {
      return lyricsCacheController.handleTranslateLyrics(message);
    }

    return undefined;
  });
});
