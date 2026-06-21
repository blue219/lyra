import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ReplacementLyrics } from './replacement-lyrics';
import { clearInlineLyrics } from './inline-lyrics';
import {
  SettingsEntry,
  readSettingsAnchor,
  type SettingsAnchor,
} from './settings-entry';
import {
  calculateCenteredScrollTop,
  createLyricsKey,
  createLyricsRequestKey,
  emptyLyricsResult,
  getInitialSelectedLineState,
  getReplacementActiveLineIndex,
  getSelectedLineIndex,
  getSelectedPlaybackPositionMs,
  getVisibleActiveLineIndex,
  loadLyricsSelection,
  selectLyricsRequest,
  shouldClearSelectedLineState,
  shouldRequestVisibleSpotifyLyrics,
  shouldResetScrollTopOnPlaybackReset,
  shouldStartLyricsRequest,
  type OverlayPhase,
  type SelectedLineState,
} from './lyrics-flow';
import { defaultOverlaySettings, sanitizeOverlaySettings } from '../settings/settings';
import {
  loadOverlaySettings,
  saveOverlaySettings,
  subscribeOverlaySettings,
} from '../settings/settings-storage';
import {
  clearLyricsCache,
  getLyricsCacheSummary,
} from '../lyrics/messages';
import {
  clickSpotifyLyricLine,
  hasUnsyncedSpotifyLyricsNotice,
  markNativeSpotifyLyricsHidden,
  readCurrentTrackIdentity,
  readPlaybackPositionMs,
  readSpotifyLyricsPageContainer,
  readSpotifyLyricsSnapshot,
  seekSpotifyPlaybackToMs,
} from '../spotify/spotify-dom';
import { getExtensionApi } from '../../shared/extension-api';
import type {
  CacheSummary,
  LyricLine,
  LyricsResult,
  OverlaySettings,
  TrackIdentity,
} from '../../shared/types';

const replacementHostAttribute = 'data-lyra-replacement-host';
const replacementLineSelector = '.lyra-replacement-line';
const replacementAutoScrollPauseMs = 2_500;

export function ContentApp() {
  const extensionApi = getExtensionApi();
  const [lyrics, setLyrics] = useState<LyricsResult>(emptyLyricsResult);
  const [phase, setPhase] = useState<OverlayPhase>('waiting-track');
  const [spotifyActiveLineIndex, setSpotifyActiveLineIndex] = useState(-1);
  const [spotifyLyricsLines, setSpotifyLyricsLines] = useState<LyricLine[]>([]);
  const [currentTrack, setCurrentTrack] = useState<TrackIdentity | null>(null);
  const [playbackPositionMs, setPlaybackPositionMs] = useState<number | null>(null);
  const [hasUnsyncedSpotifyLyrics, setHasUnsyncedSpotifyLyrics] = useState(false);
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<SettingsAnchor | null>(null);
  const [cacheSummary, setCacheSummary] = useState<CacheSummary>({
    songCount: 0,
    entryCount: 0,
    maxEntries: 0,
    sizeBytes: 0,
  });
  const [isCachePending, setIsCachePending] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [replacementHost, setReplacementHost] = useState<HTMLElement | null>(null);
  const [lyricsDomVersion, setLyricsDomVersion] = useState(0);
  const [selectedLineState, setSelectedLineState] = useState<SelectedLineState | null>(
    null,
  );
  const previousPlaybackPositionMsRef = useRef<number | null>(null);
  const replacementAutoScrollPauseUntilMsRef = useRef(0);
  const isProgrammaticReplacementScrollRef = useRef(false);
  const previousSettingsOpenRef = useRef(false);

  const lyricsSelection = selectLyricsRequest(
    spotifyLyricsLines,
    currentTrack,
    hasUnsyncedSpotifyLyrics,
  );
  const lyricsRequestKey = createLyricsRequestKey(
    lyricsSelection,
    settings.targetLanguage,
    settingsLoaded,
  );
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
    let isCancelled = false;

    loadOverlaySettings(extensionApi)
      .then((nextSettings) => {
        if (isCancelled) {
          return;
        }

        setSettings(nextSettings);
        setSettingsLoaded(true);
      })
      .catch(() => {
        if (!isCancelled) {
          setSettings(defaultOverlaySettings);
          setSettingsLoaded(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [extensionApi]);

  useEffect(() => {
    return subscribeOverlaySettings(extensionApi, (nextSettings) => {
      setSettings(nextSettings);
      setSettingsLoaded(true);
    });
  }, [extensionApi]);

  async function refreshCacheSummary(): Promise<void> {
    setIsCachePending(true);

    try {
      setCacheSummary(await getLyricsCacheSummary(extensionApi));
    } finally {
      setIsCachePending(false);
    }
  }

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
  }, [settingsOpen]);

  useEffect(() => {
    const syncPlaybackState = () => {
      const nextSpotifyLyrics = readSpotifyLyricsSnapshot();
      const lyricsContainer = readSpotifyLyricsPageContainer();
      const nextHost = lyricsContainer
        ? ensureReplacementHost(document, lyricsContainer)
        : null;

      setReplacementHost((currentHost) =>
        currentHost === nextHost ? currentHost : nextHost,
      );
      setSettingsAnchor(readSettingsAnchor(lyricsContainer));
      setSpotifyActiveLineIndex(nextSpotifyLyrics?.activeLineIndex ?? -1);
      setSpotifyLyricsLines((currentLines) => {
        const nextLines = nextSpotifyLyrics?.lines ?? [];
        return createLyricsKey(currentLines) === createLyricsKey(nextLines)
          ? currentLines
          : nextLines;
      });
      setCurrentTrack(readCurrentTrackIdentity());
      setPlaybackPositionMs(readPlaybackPositionMs());
      setHasUnsyncedSpotifyLyrics(hasUnsyncedSpotifyLyricsNotice());
      setLyricsDomVersion((version) => version + 1);
    };

    syncPlaybackState();

    const intervalId = window.setInterval(syncPlaybackState, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    setSelectedLineState(null);

    if (
      !shouldStartLyricsRequest({
        selection: lyricsSelection,
        settingsLoaded,
      })
    ) {
      setLyrics(emptyLyricsResult);
      setPhase('waiting-track');
      return;
    }

    let isCancelled = false;
    loadLyricsSelection({
      selection: lyricsSelection,
      targetLanguage: settings.targetLanguage,
      onPhaseChange: ({ phase: nextPhase, lyrics: nextLyrics }) => {
        if (isCancelled) {
          return;
        }

        setLyrics(nextLyrics);
        setPhase(nextPhase);
      },
    })
      .then(({ phase: nextPhase, lyrics: nextLyrics }) => {
        if (isCancelled) {
          return;
        }

        setLyrics(nextLyrics);
        setPhase(nextPhase);
      })
      .catch(() => {
        if (!isCancelled) {
          console.error('[Lyra] content lyrics fetch rejected');
          setLyrics(emptyLyricsResult);
          setPhase('error');
        }
      });

    return () => {
      isCancelled = true;
    };
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

  useEffect(() => {
    const scroller = replacementHost?.querySelector<HTMLElement>(
      '[data-lyra-replacement-scroll="true"]',
    );

    if (!scroller) {
      return;
    }

    let isPointerScrolling = false;

    const pauseReplacementAutoScroll = () => {
      replacementAutoScrollPauseUntilMsRef.current = Date.now() + replacementAutoScrollPauseMs;
    };

    const handleWheel = () => {
      pauseReplacementAutoScroll();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!shouldTrackManualReplacementScroll(scroller, event.target)) {
        return;
      }

      isPointerScrolling = true;
      pauseReplacementAutoScroll();
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!shouldPauseReplacementAutoScrollOnMouseDown(scroller, event)) {
        return;
      }

      isPointerScrolling = true;
      pauseReplacementAutoScroll();
    };

    const handlePointerUp = () => {
      if (!isPointerScrolling) {
        return;
      }

      isPointerScrolling = false;
      pauseReplacementAutoScroll();
    };

    const handleScroll = () => {
      if (isProgrammaticReplacementScrollRef.current) {
        isProgrammaticReplacementScrollRef.current = false;
        return;
      }

      if (isPointerScrolling) {
        pauseReplacementAutoScroll();
      }
    };

    scroller.addEventListener('wheel', handleWheel, { passive: true });
    scroller.addEventListener('pointerdown', handlePointerDown);
    scroller.addEventListener('mousedown', handleMouseDown);
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      scroller.removeEventListener('wheel', handleWheel);
      scroller.removeEventListener('pointerdown', handlePointerDown);
      scroller.removeEventListener('mousedown', handleMouseDown);
      scroller.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [replacementHost]);

  useEffect(() => {
    const scroller = replacementHost?.querySelector<HTMLElement>(
      '[data-lyra-replacement-scroll="true"]',
    );
    const shouldResetScrollTop = shouldResetScrollTopOnPlaybackReset({
      previousPlaybackPositionMs: previousPlaybackPositionMsRef.current,
      playbackPositionMs,
    });

    previousPlaybackPositionMsRef.current = playbackPositionMs;

    if (!scroller) {
      return;
    }

    if (shouldResetScrollTop) {
      scroller.scrollTop = 0;
      return;
    }

    if (
      shouldPauseReplacementAutoScroll({
        pauseUntilMs: replacementAutoScrollPauseUntilMsRef.current,
        nowMs: Date.now(),
      })
    ) {
      return;
    }

    const activeLine = scroller.querySelector<HTMLElement>(
      '[data-lyra-replacement-active="true"]',
    );

    if (!activeLine) {
      return;
    }

    const scrollTop = calculateCenteredScrollTop({
      activeOffsetTop: activeLine.offsetTop,
      activeHeight: activeLine.offsetHeight,
      containerHeight: scroller.clientHeight,
      maxScrollTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
    });

    if (typeof scroller.scrollTo === 'function') {
      isProgrammaticReplacementScrollRef.current = true;
      scroller.scrollTo({
        top: scrollTop,
        behavior: 'smooth',
      });
      return;
    }

    isProgrammaticReplacementScrollRef.current = true;
    scroller.scrollTop = scrollTop;
  }, [activeLineIndex, lyrics, playbackPositionMs, replacementHost]);

  useEffect(() => {
    return () => {
      clearInlineLyrics();
      markNativeSpotifyLyricsHidden(document, false);
      document
        .querySelectorAll(`[${replacementHostAttribute}="true"]`)
        .forEach((host) => host.remove());
    };
  }, []);

  function updateSettings(patch: Partial<OverlaySettings>) {
    setSettings((currentSettings) => {
      const nextSettings = sanitizeOverlaySettings({
        ...currentSettings,
        ...patch,
      });

      void saveOverlaySettings(extensionApi, nextSettings);

      return nextSettings;
    });
  }

  async function handleClearCache() {
    setIsClearingCache(true);

    try {
      await clearLyricsCache(extensionApi);
      await refreshCacheSummary();
    } finally {
      setIsClearingCache(false);
    }
  }

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
        onClearCache={handleClearCache}
        onOpenChange={setSettingsOpen}
        onSettingsChange={updateSettings}
      />
    </>
  );
}

export function shouldMountLyricsExperience(
  isLyricsPage: boolean,
  hasVisibleLyrics: boolean,
): boolean {
  return isLyricsPage || hasVisibleLyrics;
}

export function keepReplacementLyricsInView(replacementHost: HTMLElement | null) {
  replacementHost?.scrollIntoView({
    block: 'start',
  });
}

export function shouldPauseReplacementAutoScroll({
  pauseUntilMs,
  nowMs,
}: {
  pauseUntilMs: number;
  nowMs: number;
}): boolean {
  return pauseUntilMs > nowMs;
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

export function shouldTrackManualReplacementScroll(
  scroller: HTMLElement,
  eventTarget: EventTarget | null,
): boolean {
  if (!(eventTarget instanceof Element)) {
    return false;
  }

  // Clicking a lyric row is a seek interaction, not a request to freeze lyric follow mode.
  if (eventTarget.closest(replacementLineSelector)) {
    return false;
  }

  return scroller.contains(eventTarget);
}

export function shouldPauseReplacementAutoScrollOnMouseDown(
  scroller: HTMLElement,
  event: MouseEvent,
): boolean {
  const verticalScrollbarWidth = scroller.offsetWidth - scroller.clientWidth;
  const horizontalScrollbarHeight = scroller.offsetHeight - scroller.clientHeight;
  const { left, top } = scroller.getBoundingClientRect();
  const offsetX = event.clientX - left;
  const offsetY = event.clientY - top;

  if (verticalScrollbarWidth > 0 && offsetX >= scroller.clientWidth) {
    return true;
  }

  // Native scrollbar presses may bypass pointer events, so detect gutter presses from coordinates.
  if (horizontalScrollbarHeight > 0 && offsetY >= scroller.clientHeight) {
    return true;
  }

  return false;
}

function ensureReplacementHost(
  rootDocument: Document,
  container: HTMLElement,
): HTMLElement {
  const existingHost = container.querySelector<HTMLElement>(
    `:scope > [${replacementHostAttribute}="true"]`,
  );

  if (existingHost) {
    return existingHost;
  }

  const host = rootDocument.createElement('div');
  host.setAttribute(replacementHostAttribute, 'true');
  host.className = 'lyra-replacement-host';
  container.prepend(host);

  return host;
}
