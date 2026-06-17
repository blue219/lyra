import { findActiveLyricIndex } from '../lyrics/lyrics';
import {
  requestOriginalLyrics,
  requestTranslatedLyrics,
} from '../lyrics/messages';
import { isSameSupportedLanguage } from '../../shared/supported-languages';
import type {
  LyricLine,
  LyricsResult,
  TrackIdentity,
} from '../../shared/types';

export type OverlayPhase =
  | 'waiting-track'
  | 'loading-lyrics'
  | 'loading-translation'
  | 'ready'
  | 'unavailable'
  | 'error';

export type LyricsRequestSelection =
  | { type: 'spotify'; lines: LyricLine[] }
  | { type: 'lrclib'; track: TrackIdentity }
  | { type: 'none' };

export interface SelectedLineState {
  index: number;
  lyricsSource: LyricsResult['source'];
  syncedActiveLineIndexAtSelection: number;
}

interface ActiveLineInput {
  lyricsSource: LyricsResult['source'];
  spotifyActiveLineIndex: number;
  playbackPositionMs: number | null;
  lines: LyricLine[];
}

interface SelectedPlaybackPositionInput {
  lyricsSource: LyricsResult['source'];
  selectedLineIndex: number;
  lines: LyricLine[];
}

interface VisibleActiveLineInput {
  selectedLineIndex: number | null;
  syncedActiveLineIndex: number;
}

interface LoadLyricsSelectionOptions {
  selection: LyricsRequestSelection;
  targetLanguage: string;
  requestOriginalLyricsFn?: typeof requestOriginalLyrics;
  requestTranslatedLyricsFn?: typeof requestTranslatedLyrics;
  onPhaseChange?: (snapshot: { phase: OverlayPhase; lyrics: LyricsResult }) => void;
}

interface InitialSelectedLineStateInput {
  selectedLineIndex: number;
  lyricsSource: LyricsResult['source'];
  syncedActiveLineIndex: number;
}

interface ShouldClearSelectedLineStateInput {
  selectedLineState: SelectedLineState | null;
  syncedActiveLineIndex: number;
}

interface ShouldStartLyricsRequestInput {
  selection: LyricsRequestSelection;
  settingsLoaded: boolean;
}

export const emptyLyricsResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

export function shouldRequestVisibleSpotifyLyrics(lines: LyricLine[]): boolean {
  return lines.length > 0;
}

export function selectLyricsRequest(
  spotifyLyricsLines: LyricLine[],
  track: TrackIdentity | null,
  hasUnsyncedSpotifyLyrics: boolean,
): LyricsRequestSelection {
  if (
    shouldRequestVisibleSpotifyLyrics(spotifyLyricsLines) &&
    (!hasUnsyncedSpotifyLyrics || !track)
  ) {
    return {
      type: 'spotify',
      lines: spotifyLyricsLines,
    };
  }

  if (track) {
    return {
      type: 'lrclib',
      track,
    };
  }

  return { type: 'none' };
}

export function getReplacementActiveLineIndex({
  lyricsSource,
  spotifyActiveLineIndex,
  playbackPositionMs,
  lines,
}: ActiveLineInput): number {
  if (lyricsSource === 'spotify') {
    return spotifyActiveLineIndex;
  }

  if (lyricsSource === 'lrclib' && playbackPositionMs !== null) {
    return findActiveLyricIndex(lines, playbackPositionMs);
  }

  return -1;
}

export function getSelectedPlaybackPositionMs({
  lyricsSource,
  selectedLineIndex,
  lines,
}: SelectedPlaybackPositionInput): number | null {
  if (lyricsSource !== 'lrclib') {
    return null;
  }

  return lines[selectedLineIndex]?.timeMs ?? null;
}

export function getVisibleActiveLineIndex({
  selectedLineIndex,
  syncedActiveLineIndex,
}: VisibleActiveLineInput): number {
  return selectedLineIndex ?? syncedActiveLineIndex;
}

export function getInitialSelectedLineState({
  selectedLineIndex,
  lyricsSource,
  syncedActiveLineIndex,
}: InitialSelectedLineStateInput): SelectedLineState {
  return {
    index: selectedLineIndex,
    lyricsSource,
    syncedActiveLineIndexAtSelection: syncedActiveLineIndex,
  };
}

export function getSelectedLineIndex(
  selectedLineState: SelectedLineState | null,
): number | null {
  return selectedLineState?.index ?? null;
}

export function shouldClearSelectedLineState({
  selectedLineState,
  syncedActiveLineIndex,
}: ShouldClearSelectedLineStateInput): boolean {
  if (!selectedLineState) {
    return false;
  }

  if (selectedLineState.lyricsSource === 'lrclib') {
    return syncedActiveLineIndex === selectedLineState.index;
  }

  return (
    syncedActiveLineIndex !== -1 &&
    syncedActiveLineIndex !== selectedLineState.syncedActiveLineIndexAtSelection
  );
}

export function calculateCenteredScrollTop({
  activeOffsetTop,
  activeHeight,
  containerHeight,
  maxScrollTop,
}: {
  activeOffsetTop: number;
  activeHeight: number;
  containerHeight: number;
  maxScrollTop: number;
}): number {
  const centeredTop = activeOffsetTop + activeHeight / 2 - containerHeight / 2;

  return Math.min(Math.max(0, centeredTop), maxScrollTop);
}

export function shouldResetScrollTopOnPlaybackReset({
  previousPlaybackPositionMs,
  playbackPositionMs,
}: {
  previousPlaybackPositionMs: number | null;
  playbackPositionMs: number | null;
}): boolean {
  if (previousPlaybackPositionMs === null || playbackPositionMs === null) {
    return false;
  }

  // Treat a large jump back to the song start as a playback reset, not a normal sync tick.
  return previousPlaybackPositionMs >= 3_000 && playbackPositionMs <= 1_000;
}

export function createLyricsRequestKey(
  selection: LyricsRequestSelection,
  targetLanguage: string,
  settingsLoaded: boolean,
): string {
  if (!settingsLoaded) {
    return 'pending-settings';
  }

  if (selection.type === 'spotify') {
    return ['spotify', targetLanguage, createLyricsKey(selection.lines)].join('__');
  }

  if (selection.type === 'lrclib') {
    return [
      'lrclib',
      targetLanguage,
      selection.track.title,
      selection.track.artists.join(','),
      selection.track.album ?? '',
      selection.track.durationSeconds ?? '',
    ].join('__');
  }

  return 'none';
}

export function shouldStartLyricsRequest({
  selection,
  settingsLoaded,
}: ShouldStartLyricsRequestInput): boolean {
  return settingsLoaded && selection.type !== 'none';
}

export async function loadLyricsSelection({
  selection,
  targetLanguage,
  requestOriginalLyricsFn = requestOriginalLyrics,
  requestTranslatedLyricsFn = requestTranslatedLyrics,
  onPhaseChange,
}: LoadLyricsSelectionOptions): Promise<{ phase: OverlayPhase; lyrics: LyricsResult }> {
  if (selection.type === 'spotify') {
    onPhaseChange?.({
      phase: 'loading-lyrics',
      lyrics: emptyLyricsResult,
    });

    const monolingualLyrics: LyricsResult = {
      status: 'monolingual',
      lines: selection.lines,
      source: 'spotify',
    };

    onPhaseChange?.({
      phase: 'loading-translation',
      lyrics: monolingualLyrics,
    });

    const translatedLyrics = await requestTranslatedLyricsFn(
      selection.lines,
      targetLanguage,
      'spotify',
    );

    return {
      phase: translatedLyrics.status === 'unavailable' ? 'unavailable' : 'ready',
      lyrics: translatedLyrics,
    };
  }

  if (selection.type === 'lrclib') {
    onPhaseChange?.({
      phase: 'loading-lyrics',
      lyrics: emptyLyricsResult,
    });

    const fetchedLyrics = await requestOriginalLyricsFn(selection.track);

    if (fetchedLyrics.status === 'unavailable' || fetchedLyrics.lines.length === 0) {
      return {
        phase: 'unavailable',
        lyrics: fetchedLyrics,
      };
    }

    if (isSameSupportedLanguage(fetchedLyrics.sourceLanguage, targetLanguage)) {
      return {
        phase: 'ready',
        lyrics: fetchedLyrics,
      };
    }

    onPhaseChange?.({
      phase: 'loading-translation',
      lyrics: fetchedLyrics,
    });

    const translatedLyrics = await requestTranslatedLyricsFn(
      fetchedLyrics.lines,
      targetLanguage,
      fetchedLyrics.source,
    );

    return {
      phase: translatedLyrics.status === 'unavailable' ? 'unavailable' : 'ready',
      lyrics: translatedLyrics,
    };
  }

  return {
    phase: 'waiting-track',
    lyrics: emptyLyricsResult,
  };
}

export function createLyricsKey(lines: LyricLine[]): string {
  return lines.map((line) => line.original).join('\n');
}
