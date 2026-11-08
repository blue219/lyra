import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { getExtensionApi } from '@/src/adapters/chrome/extension-api';
import { useLyricsCacheSummary } from '@/src/ui/settings/use-lyrics-cache-summary';
import { useOverlaySettings } from '@/src/ui/settings/use-overlay-settings';
import {
  clickSpotifyLyricLine,
  createSpotifyDomAdapter,
  markNativeSpotifyLyricsHidden,
  seekSpotifyPlaybackToMs,
  spotifyCinemaScrollHostSelector,
} from '@/src/adapters/spotify/spotify-dom';
import {
  requestCoverPalette,
  requestLyrics,
  requestTranslatedLyrics,
} from '@/src/adapters/chrome/runtime-client';
import {
  fixedCoverPalette,
  type CoverPalette,
} from '@/src/domain/cover-palette';
import { createOverlayController } from '@/src/application/overlay-controller';
import {
  getInitialSelectedLineState,
  getSelectedLineIndex,
  getSelectedPlaybackPositionMs,
  getVisibleActiveLineIndex,
  shouldClearSelectedLineState,
  shouldRequestVisibleSpotifyLyrics,
  type SelectedLineState,
} from '@/src/application/lyrics-flow';
import { removeLegacyInlineLyrics } from './legacy-cleanup';
import { ReplacementLyrics } from './replacement-lyrics';
import {
  ensureReplacementHost,
  observeCinemaToolbar,
  removeReplacementHosts,
} from './replacement-host';
import {
  keepReplacementLyricsInView,
  useReplacementAutoScroll,
} from './replacement-scroll';
import { SettingsEntry } from './settings-entry';
import { readSettingsAnchor } from './settings-entry';

export { shouldMountLyricsExperience } from './replacement-host';
export {
  keepReplacementLyricsInView,
  shouldPauseReplacementAutoScroll,
  shouldPauseReplacementAutoScrollOnMouseDown,
  shouldTrackManualReplacementScroll,
} from './replacement-scroll';

export function ContentApp() {
  const [extensionApi] = useState(() => getExtensionApi());
  const [controller] = useState(() =>
    createOverlayController({
      spotify: createSpotifyDomAdapter(),
      lyricsClient: {
        fetchLyrics: (track, targetLanguage) =>
          requestLyrics({ track, targetLanguage }),
        translateLyrics: (lines, targetLanguage, source) =>
          requestTranslatedLyrics({ lines, targetLanguage, source }),
      },
    }),
  );
  const controllerState = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replacementHost, setReplacementHost] = useState<HTMLElement | null>(
    null,
  );
  const [selectedLineState, setSelectedLineState] =
    useState<SelectedLineState | null>(null);
  const [selectionScrollRequestId, setSelectionScrollRequestId] = useState(0);
  const [coverPalette, setCoverPalette] =
    useState<CoverPalette>(fixedCoverPalette);
  const previousSettingsOpenRef = useRef(false);
  const {
    settings,
    isSettingsLoaded,
    updateSettings,
    settingsError,
    reloadSettings,
  } = useOverlaySettings(extensionApi);
  const {
    cacheSummary,
    isCachePending,
    isClearingCache,
    refreshCacheSummary,
    clearCache,
    cacheError,
  } = useLyricsCacheSummary({ extensionApi });
  const {
    lyrics,
    phase,
    requestKey: lyricsRequestKey,
    activeLineIndex: syncedActiveLineIndex,
    spotifyLyricsLines,
    coverImageUrl,
    playbackPositionMs,
    lyricsContainer,
  } = controllerState;
  const settingsAnchor = readSettingsAnchor(
    lyricsContainer,
    lyricsContainer?.matches(spotifyCinemaScrollHostSelector),
  );
  const activeLineIndex = getVisibleActiveLineIndex({
    selectedLineIndex: getSelectedLineIndex(selectedLineState),
    syncedActiveLineIndex,
  });

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  useEffect(() => {
    if (isSettingsLoaded) controller.setTargetLanguage(settings.targetLanguage);
  }, [controller, isSettingsLoaded, settings.targetLanguage]);

  useEffect(() => {
    if (!lyricsContainer) {
      removeReplacementHosts(document);
      setReplacementHost(null);
      return;
    }
    setReplacementHost(ensureReplacementHost(document, lyricsContainer));
    if (lyricsContainer.matches(spotifyCinemaScrollHostSelector)) {
      return observeCinemaToolbar(lyricsContainer);
    }
  }, [lyricsContainer]);

  useEffect(() => {
    let isCurrent = true;

    if (!coverImageUrl) {
      setCoverPalette(fixedCoverPalette);
      return () => {
        isCurrent = false;
      };
    }

    void requestCoverPalette({ coverImageUrl })
      .then((nextPalette) => {
        if (isCurrent) setCoverPalette(nextPalette ?? fixedCoverPalette);
      })
      .catch(() => {
        if (isCurrent) setCoverPalette(fixedCoverPalette);
      });

    return () => {
      isCurrent = false;
    };
  }, [coverImageUrl]);

  useEffect(() => {
    const shouldRefresh = shouldRefreshCacheSummaryOnOpen({
      isOpen: settingsOpen,
      wasOpen: previousSettingsOpenRef.current,
    });

    previousSettingsOpenRef.current = settingsOpen;

    if (!shouldRefresh) {
      return;
    }

    void refreshCacheSummary();
  }, [refreshCacheSummary, settingsOpen]);

  useEffect(() => {
    setSelectedLineState(null);
  }, [lyricsRequestKey]);

  useEffect(() => {
    if (
      !shouldClearSelectedLineState({
        selectedLineState,
        syncedActiveLineIndex,
      })
    ) {
      return;
    }

    setSelectedLineState(null);
  }, [selectedLineState, syncedActiveLineIndex]);

  useEffect(() => {
    const shouldHideNativeLyrics =
      replacementHost !== null &&
      shouldRequestVisibleSpotifyLyrics(spotifyLyricsLines);

    markNativeSpotifyLyricsHidden(document, shouldHideNativeLyrics);

    return () => {
      markNativeSpotifyLyricsHidden(document, false);
    };
  }, [replacementHost, spotifyLyricsLines]);

  useReplacementAutoScroll({
    activeLineIndex,
    lyrics,
    playbackPositionMs,
    replacementHost,
    scrollRequestId: selectionScrollRequestId,
  });

  useEffect(() => {
    removeLegacyInlineLyrics(document);

    return () => {
      markNativeSpotifyLyricsHidden(document, false);
      removeReplacementHosts(document);
    };
  }, []);

  function selectReplacementLine(index: number) {
    if (!lyrics.lines[index]) {
      return;
    }

    setSelectedLineState(
      getInitialSelectedLineState({
        selectedLineIndex: index,
        lyricsSource: lyrics.source,
        syncedActiveLineIndex,
      }),
    );
    setSelectionScrollRequestId((requestId) => requestId + 1);
    keepReplacementLyricsInView(replacementHost);

    if (lyrics.source === 'spotify') {
      clickSpotifyLyricLine(index);
      window.setTimeout(() => {
        keepReplacementLyricsInView(replacementHost);
      }, 0);
      return;
    }

    const selectedPlaybackPositionMs = getSelectedPlaybackPositionMs({
      lyricsSource: lyrics.source,
      selectedLineIndex: index,
      lines: lyrics.lines,
    });

    if (selectedPlaybackPositionMs === null) {
      return;
    }

    seekSpotifyPlaybackToMs(selectedPlaybackPositionMs);
  }

  if (!replacementHost) {
    return null;
  }

  return (
    <>
      {createPortal(
        <ReplacementLyrics
          activeLineIndex={activeLineIndex}
          coverPalette={coverPalette}
          dynamicBackground={settings.dynamicBackground}
          fontSize={settings.fontSize}
          phase={phase}
          lyrics={lyrics}
          onLineSelect={selectReplacementLine}
          targetLanguage={settings.targetLanguage}
        />,
        replacementHost,
      )}

      <SettingsEntry
        anchor={settingsAnchor}
        cacheSummary={cacheSummary}
        isOpen={settingsOpen}
        isCachePending={isCachePending}
        isClearingCache={isClearingCache}
        settings={settings}
        onClearCache={clearCache}
        onOpenChange={setSettingsOpen}
        onSettingsChange={updateSettings}
        errorMessage={settingsError ?? cacheError}
        onRetry={() => {
          void reloadSettings();
          void refreshCacheSummary();
        }}
      />
    </>
  );
}

export function shouldRefreshCacheSummaryOnOpen({
  isOpen,
  wasOpen,
}: {
  isOpen: boolean;
  wasOpen: boolean;
}): boolean {
  return isOpen && !wasOpen;
}
