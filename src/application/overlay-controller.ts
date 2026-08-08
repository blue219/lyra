import type {
  LyricLine,
  LyricsResult,
  TrackIdentity,
} from '@/src/domain/model';
import type { LyricsClient } from '@/src/ports/lyrics-client';
import type { SpotifyPort } from '@/src/ports/spotify';
import { systemClock, type Clock } from '@/src/ports/clock';
import {
  createLyricsKey,
  createLyricsRequestKey,
  selectLyricsRequest,
  type LyricsRequestSelection,
  type OverlayPhase,
} from './lyrics-flow';
import { findActiveLyricIndex } from '@/src/domain/lyrics';

export interface OverlayControllerState {
  phase: OverlayPhase;
  lyrics: LyricsResult;
  activeLineIndex: number;
  spotifyLyricsLines: LyricLine[];
  currentTrack: TrackIdentity | null;
  hasUnsyncedSpotifyLyrics: boolean;
  lyricsContainer: HTMLElement | null;
  requestKey: string;
  playbackPositionMs: number | null;
}

interface OverlayControllerOptions {
  spotify: SpotifyPort;
  lyricsClient: LyricsClient;
  clock?: Clock;
  setInterval?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setInterval>;
  clearInterval?: (handle: ReturnType<typeof setInterval>) => void;
  throttleMs?: number;
  playbackPollMs?: number;
}

const emptyLyrics: LyricsResult = {
  status: 'unavailable',
  reason: 'not-found',
  lines: [],
};

export function createOverlayController(options: OverlayControllerOptions) {
  const clock = options.clock ?? systemClock;
  const setIntervalFn = options.setInterval ?? setInterval;
  const clearIntervalFn = options.clearInterval ?? clearInterval;
  const listeners = new Set<() => void>();
  let targetLanguage: string | null = null;
  let started = false;
  let stopObserving: (() => void) | null = null;
  let throttleHandle: ReturnType<typeof setTimeout> | null = null;
  let pollHandle: number | ReturnType<typeof setInterval> | null = null;
  let requestController: AbortController | null = null;
  let state: OverlayControllerState = {
    phase: 'waiting-track',
    lyrics: emptyLyrics,
    activeLineIndex: -1,
    spotifyLyricsLines: [],
    currentTrack: null,
    hasUnsyncedSpotifyLyrics: false,
    lyricsContainer: null,
    requestKey: 'pending-settings',
    playbackPositionMs: null,
  };

  const publish = (next: OverlayControllerState) => {
    if (isSemanticStateEqual(state, next)) return;
    state = next;
    listeners.forEach((listener) => listener());
    syncPlaybackPolling();
  };

  const scheduleSync = () => {
    if (!started || throttleHandle !== null) return;
    throttleHandle = clock.setTimeout(() => {
      throttleHandle = null;
      syncSnapshot();
    }, options.throttleMs ?? 100);
  };

  const syncSnapshot = () => {
    const snapshot = options.spotify.readSnapshot();
    const selection = selectLyricsRequest(
      snapshot.lyricsLines,
      snapshot.track,
      snapshot.hasUnsyncedLyrics,
    );
    const requestKey = createLyricsRequestKey(
      selection,
      targetLanguage ?? '',
      targetLanguage !== null,
    );
    const shouldLoad =
      requestKey !== state.requestKey || state.phase === 'waiting-track';
    const activeLineIndex =
      state.lyrics.status === 'available' && state.lyrics.source === 'spotify'
        ? snapshot.activeLineIndex
        : state.activeLineIndex;

    publish({
      ...state,
      activeLineIndex,
      spotifyLyricsLines: snapshot.lyricsLines,
      currentTrack: snapshot.track,
      hasUnsyncedSpotifyLyrics: snapshot.hasUnsyncedLyrics,
      lyricsContainer: snapshot.lyricsContainer,
      requestKey,
    });

    if (shouldLoad) {
      void loadSelection(selection, requestKey);
    }
  };

  const loadSelection = async (
    selection: LyricsRequestSelection,
    requestKey: string,
  ) => {
    requestController?.abort(
      new DOMException('Lyrics selection changed', 'AbortError'),
    );
    const controller = new AbortController();
    requestController = controller;

    if (!targetLanguage || selection.type === 'none') {
      publish({
        ...state,
        phase: 'waiting-track',
        lyrics: emptyLyrics,
        activeLineIndex: -1,
        requestKey,
      });
      return;
    }

    try {
      if (selection.type === 'spotify') {
        const original: LyricsResult = {
          status: 'available',
          source: 'spotify',
          lines: selection.lines,
        };
        publish({
          ...state,
          phase: 'loading-translation',
          lyrics: original,
          requestKey,
        });
        const result = await options.lyricsClient.translateLyrics(
          selection.lines,
          targetLanguage,
          'spotify',
        );
        if (controller.signal.aborted) return;
        publish({
          ...state,
          phase: result.status === 'available' ? 'ready' : 'unavailable',
          lyrics: result,
          activeLineIndex: options.spotify.readSnapshot().activeLineIndex,
          requestKey,
        });
        return;
      }

      publish({ ...state, phase: 'loading-lyrics', requestKey });
      const result = await options.lyricsClient.fetchLyrics(
        selection.track,
        targetLanguage,
      );
      if (controller.signal.aborted) return;
      publish({
        ...state,
        phase: result.status === 'available' ? 'ready' : 'unavailable',
        lyrics: result,
        activeLineIndex: -1,
        requestKey,
      });
    } catch {
      if (controller.signal.aborted) return;
      const fallback =
        selection.type === 'spotify'
          ? {
              status: 'available' as const,
              source: 'spotify' as const,
              lines: selection.lines,
              degradationReason: 'provider-error' as const,
            }
          : emptyLyrics;
      publish({
        ...state,
        phase: fallback.status === 'available' ? 'ready' : 'error',
        lyrics: fallback,
        requestKey,
      });
    }
  };

  const syncPlaybackPolling = () => {
    const shouldPoll =
      started &&
      state.lyrics.status === 'available' &&
      state.lyrics.source === 'lrclib';
    if (!shouldPoll && pollHandle !== null) {
      clearIntervalFn(pollHandle as ReturnType<typeof setInterval>);
      pollHandle = null;
    } else if (shouldPoll && pollHandle === null) {
      pollHandle = setIntervalFn(() => {
        if (
          !options.spotify.isDocumentVisible() ||
          state.lyrics.status !== 'available'
        ) {
          return;
        }
        const position = options.spotify.readPlaybackPositionMs();
        if (position === null) return;
        const activeLineIndex = findActiveLyricIndex(
          state.lyrics.lines,
          position,
        );
        if (activeLineIndex === state.activeLineIndex) return;
        publish({ ...state, activeLineIndex, playbackPositionMs: position });
      }, options.playbackPollMs ?? 250);
    }
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started) return;
      started = true;
      stopObserving = options.spotify.observe(scheduleSync);
      syncSnapshot();
    },
    stop() {
      if (!started) return;
      started = false;
      stopObserving?.();
      stopObserving = null;
      requestController?.abort(
        new DOMException('Overlay disposed', 'AbortError'),
      );
      requestController = null;
      if (throttleHandle !== null) clock.clearTimeout(throttleHandle);
      throttleHandle = null;
      if (pollHandle !== null) {
        clearIntervalFn(pollHandle as ReturnType<typeof setInterval>);
      }
      pollHandle = null;
    },
    setTargetLanguage(language: string) {
      if (targetLanguage === language) return;
      targetLanguage = language;
      if (started) syncSnapshot();
    },
  };
}

function isSemanticStateEqual(
  left: OverlayControllerState,
  right: OverlayControllerState,
): boolean {
  return (
    left.phase === right.phase &&
    left.activeLineIndex === right.activeLineIndex &&
    left.requestKey === right.requestKey &&
    left.lyricsContainer === right.lyricsContainer &&
    left.hasUnsyncedSpotifyLyrics === right.hasUnsyncedSpotifyLyrics &&
    createLyricsKey(left.spotifyLyricsLines) ===
      createLyricsKey(right.spotifyLyricsLines) &&
    lyricsResultKey(left.lyrics) === lyricsResultKey(right.lyrics)
  );
}

function lyricsResultKey(result: LyricsResult): string {
  return result.status === 'unavailable'
    ? `unavailable:${result.reason}`
    : [
        result.source,
        result.sourceLanguage ?? '',
        result.degradationReason ?? '',
        createLyricsKey(result.lines),
        result.lines.map((line) => line.translated ?? '').join('\n'),
      ].join(':');
}
