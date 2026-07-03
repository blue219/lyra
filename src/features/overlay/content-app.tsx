import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getExtensionApi } from '../../shared/extension-api';
import { useLyricsCacheSummary } from '../lyrics/use-lyrics-cache-summary';
import { useOverlaySettings } from '../settings/use-overlay-settings';
import {
  clickSpotifyLyricLine,
  markNativeSpotifyLyricsHidden,
  seekSpotifyPlaybackToMs,
} from '../spotify/spotify-dom';
import { clearInlineLyrics } from './inline-lyrics';
import {
  getInitialSelectedLineState,
  getReplacementActiveLineIndex,
  getSelectedLineIndex,
  getSelectedPlaybackPositionMs,
  getVisibleActiveLineIndex,
  selectLyricsRequest,
  shouldClearSelectedLineState,
  shouldRequestVisibleSpotifyLyrics,
  type SelectedLineState,
} from './lyrics-flow';
import { ReplacementLyrics } from './replacement-lyrics';
import { removeReplacementHosts } from './replacement-host';
import {
  keepReplacementLyricsInView,
  useReplacementAutoScroll,
} from './replacement-scroll';
import { SettingsEntry } from './settings-entry';
import { useLoadedLyrics } from './use-loaded-lyrics';
import { useSpotifyLyricsExperience } from './use-spotify-lyrics-experience';

export {
  shouldMountLyricsExperience,
} from './replacement-host';
export {
  keepReplacementLyricsInView,
  shouldPauseReplacementAutoScroll,
  shouldPauseReplacementAutoScrollOnMouseDown,
  shouldTrackManualReplacementScroll,
} from './replacement-scroll';

export function ContentApp() {
  const [extensionApi] = useState(() => getExtensionApi());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLineState, setSelectedLineState] = useState<SelectedLineState | null>(
    null,
  );
  const previousSettingsOpenRef = useRef(false);
  const {
    settings,
    isSettingsLoaded,
    updateSettings,
  } = useOverlaySettings(extensionApi);
  const {
    cacheSummary,
    isCachePending,
    isClearingCache,
    refreshCacheSummary,
    clearCache,
  } = useLyricsCacheSummary({ extensionApi });
  const {
    spotifyActiveLineIndex,
    spotifyLyricsLines,
    currentTrack,
    playbackPositionMs,
    setPlaybackPositionMs,
    hasUnsyncedSpotifyLyrics,
    settingsAnchor,
    replacementHost,
    lyricsDomVersion,
  } = useSpotifyLyricsExperience();
  const lyricsSelection = selectLyricsRequest(
    spotifyLyricsLines,
    currentTrack,
    hasUnsyncedSpotifyLyrics,
  );
  const { lyrics, phase, lyricsRequestKey } = useLoadedLyrics({
    selection: lyricsSelection,
    targetLanguage: settings.targetLanguage,
    settingsLoaded: isSettingsLoaded,
  });
  const syncedActiveLineIndex = getReplacementActiveLineIndex({
    lyricsSource: lyrics.source,
    spotifyActiveLineIndex,
    playbackPositionMs,
    lines: lyrics.lines,
  });
  const activeLineIndex = getVisibleActiveLineIndex({
    selectedLineIndex: getSelectedLineIndex(selectedLineState),
    syncedActiveLineIndex,
  });

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
      replacementHost !== null && shouldRequestVisibleSpotifyLyrics(spotifyLyricsLines);

    markNativeSpotifyLyricsHidden(document, shouldHideNativeLyrics);

    return () => {
      markNativeSpotifyLyricsHidden(document, false);
    };
  }, [lyricsDomVersion, replacementHost, spotifyLyricsLines]);

  useEffect(() => {
    clearInlineLyrics();
  }, [lyricsDomVersion]);

  useReplacementAutoScroll({
    activeLineIndex,
    lyrics,
    playbackPositionMs,
    replacementHost,
  });

  useEffect(() => {
    return () => {
      clearInlineLyrics();
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

    setPlaybackPositionMs(selectedPlaybackPositionMs);
    seekSpotifyPlaybackToMs(selectedPlaybackPositionMs);
  }

  if (!replacementHost && lyricsSelection.type === 'none') {
    return null;
  }

  return (
    <>
      {replacementHost
        ? createPortal(
            <ReplacementLyrics
              activeLineIndex={activeLineIndex}
              dynamicBackground={settings.dynamicBackground}
              fontSize={settings.fontSize}
              phase={phase}
              lyrics={lyrics}
              onLineSelect={selectReplacementLine}
              targetLanguage={settings.targetLanguage}
            />,
            replacementHost,
          )
        : null}

      <SettingsEntry
        anchor={settingsAnchor}
        cacheSummary={cacheSummary}
        isOpen={settingsOpen}
        isCachePending={isCachePending}
        isClearingCache={isClearingCache}
        lyrics={lyrics}
        phase={phase}
        settings={settings}
        onClearCache={clearCache}
        onOpenChange={setSettingsOpen}
        onSettingsChange={updateSettings}
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
