import { createToolbarActionGate } from '@/src/application/action-gate';
import { createLyricsCacheController } from '@/src/application/cache-controller';
import { createTranslationOrchestrator } from '@/src/application/translate';
import { fetchLyricsFromLrclib } from '@/src/adapters/http/lrclib';
import { translateGoogleLineChunk } from '@/src/adapters/http/google-provider';
import { getExtensionApi } from '@/src/adapters/chrome/extension-api';
import { createRuntimeHandlerRegistry } from '@/src/ports/runtime';
import { maxLyricsCacheEntries } from '@/src/domain/cache';
import { createCoverPaletteResolver } from '@/src/adapters/http/cover-palette';

const translateLyrics = createTranslationOrchestrator([
  translateGoogleLineChunk,
]);
const lyricsCacheController = createLyricsCacheController({
  missTtlMs: 5 * 60 * 1_000,
  degradedTtlMs: 2 * 60 * 1_000,
  transientMissTtlMs: 60 * 1_000,
  maxEntries: maxLyricsCacheEntries,
  getStorage: () => getExtensionApi()?.storage?.local,
  fetchLyrics: fetchLyricsFromLrclib,
  translateLyrics,
});
const coverPaletteResolver = createCoverPaletteResolver();

const handleRuntimeMessage = createRuntimeHandlerRegistry({
  'lyra:fetchLyrics': ({ track, targetLanguage }) =>
    lyricsCacheController.handleFetchLyrics(track, targetLanguage),
  'lyra:translateLyrics': (request) =>
    lyricsCacheController.handleTranslateLyrics(request),
  'lyra:getLyricsCacheSummary': () => lyricsCacheController.getCacheSummary(),
  'lyra:clearLyricsCache': async () => {
    await lyricsCacheController.clearCache();
    return { ok: true };
  },
  'lyra:resolveCoverPalette': ({ coverImageUrl }) =>
    coverPaletteResolver.resolve(coverImageUrl),
});

export default defineBackground({
  type: 'module',
  main() {
    const extensionApi = getExtensionApi();

    if (extensionApi?.action && extensionApi.declarativeContent) {
      void createToolbarActionGate({
        action: extensionApi.action,
        declarativeContent: extensionApi.declarativeContent,
      }).start();
    }

    extensionApi?.runtime?.onMessage.addListener(handleRuntimeMessage);
  },
});
