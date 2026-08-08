import { describe, expect, test, vi } from 'vitest';

import type {
  LyricLine,
  LyricsResult,
  TrackIdentity,
} from '@/src/domain/model';
import {
  calculateCenteredScrollTop,
  createLyricsKey,
  createLyricsRequestKey,
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
} from './lyrics-flow';

const lines: LyricLine[] = [
  { timeMs: 0, original: 'Hello' },
  { timeMs: 4_000, original: 'World' },
];
const track: TrackIdentity = {
  title: 'Song',
  artists: ['Artist'],
  album: 'Album',
  durationSeconds: 180,
};

describe('lyrics flow selection and keys', () => {
  test('selects Spotify, LRCLIB, or none from the observable inputs', () => {
    expect(shouldRequestVisibleSpotifyLyrics([])).toBe(false);
    expect(shouldRequestVisibleSpotifyLyrics(lines)).toBe(true);
    expect(selectLyricsRequest(lines, track, false)).toEqual({
      type: 'spotify',
      lines,
    });
    expect(selectLyricsRequest(lines, track, true)).toEqual({
      type: 'lrclib',
      track,
    });
    expect(selectLyricsRequest(lines, null, true)).toEqual({
      type: 'spotify',
      lines,
    });
    expect(selectLyricsRequest([], track, false)).toEqual({
      type: 'lrclib',
      track,
    });
    expect(selectLyricsRequest([], null, false)).toEqual({ type: 'none' });
  });

  test('builds stable request keys only after settings load', () => {
    expect(createLyricsRequestKey({ type: 'none' }, 'fr-FR', false)).toBe(
      'pending-settings',
    );
    expect(createLyricsRequestKey({ type: 'none' }, 'fr-FR', true)).toBe(
      'none',
    );
    expect(
      createLyricsRequestKey({ type: 'spotify', lines }, 'fr-FR', true),
    ).toBe('spotify__fr-FR__Hello\nWorld');
    expect(
      createLyricsRequestKey({ type: 'lrclib', track }, 'fr-FR', true),
    ).toBe('lrclib__fr-FR__Song__Artist__Album__180');
    expect(createLyricsKey(lines)).toBe('Hello\nWorld');
    expect(
      shouldStartLyricsRequest({
        selection: { type: 'none' },
        settingsLoaded: true,
      }),
    ).toBe(false);
    expect(
      shouldStartLyricsRequest({
        selection: { type: 'lrclib', track },
        settingsLoaded: false,
      }),
    ).toBe(false);
    expect(
      shouldStartLyricsRequest({
        selection: { type: 'lrclib', track },
        settingsLoaded: true,
      }),
    ).toBe(true);
  });
});

describe('lyrics flow orchestration', () => {
  test('translates Spotify lines and reports both loading phases', async () => {
    const phases: string[] = [];
    const translated: LyricsResult = {
      status: 'available',
      source: 'spotify',
      lines: [{ ...lines[0]!, translated: 'Bonjour' }],
    };
    const requestTranslatedLyrics = vi.fn().mockResolvedValue(translated);
    await expect(
      loadLyricsSelection({
        selection: { type: 'spotify', lines },
        targetLanguage: 'fr-FR',
        requestLyrics: vi.fn(),
        requestTranslatedLyrics,
        onPhaseChange: ({ phase }) => phases.push(phase),
      }),
    ).resolves.toEqual({ phase: 'ready', lyrics: translated });
    expect(phases).toEqual(['loading-lyrics', 'loading-translation']);
    expect(requestTranslatedLyrics).toHaveBeenCalledWith(
      lines,
      'fr-FR',
      'spotify',
    );
  });

  test('maps unavailable Spotify translation and LRCLIB results', async () => {
    const unavailable: LyricsResult = {
      status: 'unavailable',
      reason: 'provider-error',
      lines: [],
    };
    await expect(
      loadLyricsSelection({
        selection: { type: 'spotify', lines },
        targetLanguage: 'fr-FR',
        requestLyrics: vi.fn(),
        requestTranslatedLyrics: vi.fn().mockResolvedValue(unavailable),
      }),
    ).resolves.toEqual({ phase: 'unavailable', lyrics: unavailable });
    await expect(
      loadLyricsSelection({
        selection: { type: 'lrclib', track },
        targetLanguage: 'fr-FR',
        requestLyrics: vi.fn().mockResolvedValue(unavailable),
        requestTranslatedLyrics: vi.fn(),
      }),
    ).resolves.toEqual({ phase: 'unavailable', lyrics: unavailable });
  });

  test('returns ready LRCLIB results and waits when no source exists', async () => {
    const available: LyricsResult = {
      status: 'available',
      source: 'lrclib',
      lines,
    };
    await expect(
      loadLyricsSelection({
        selection: { type: 'lrclib', track },
        targetLanguage: 'fr-FR',
        requestLyrics: vi.fn().mockResolvedValue(available),
        requestTranslatedLyrics: vi.fn(),
      }),
    ).resolves.toEqual({ phase: 'ready', lyrics: available });
    await expect(
      loadLyricsSelection({
        selection: { type: 'none' },
        targetLanguage: 'fr-FR',
        requestLyrics: vi.fn(),
        requestTranslatedLyrics: vi.fn(),
      }),
    ).resolves.toMatchObject({ phase: 'waiting-track' });
  });
});

describe('lyrics interaction rules', () => {
  test('chooses native or timestamp-driven active lines', () => {
    expect(
      getReplacementActiveLineIndex({
        lyricsSource: 'spotify',
        spotifyActiveLineIndex: 3,
        playbackPositionMs: 0,
        lines,
      }),
    ).toBe(3);
    expect(
      getReplacementActiveLineIndex({
        lyricsSource: 'lrclib',
        spotifyActiveLineIndex: -1,
        playbackPositionMs: 4_100,
        lines,
      }),
    ).toBe(1);
    expect(
      getReplacementActiveLineIndex({
        lyricsSource: 'lrclib',
        spotifyActiveLineIndex: -1,
        playbackPositionMs: null,
        lines,
      }),
    ).toBe(-1);
  });

  test('handles selected lines for both providers', () => {
    const lrclib = getInitialSelectedLineState({
      selectedLineIndex: 1,
      lyricsSource: 'lrclib',
      syncedActiveLineIndex: 0,
    });
    const spotify = getInitialSelectedLineState({
      selectedLineIndex: 1,
      lyricsSource: 'spotify',
      syncedActiveLineIndex: 0,
    });
    expect(getSelectedLineIndex(lrclib)).toBe(1);
    expect(getSelectedLineIndex(null)).toBeNull();
    expect(
      shouldClearSelectedLineState({
        selectedLineState: null,
        syncedActiveLineIndex: 1,
      }),
    ).toBe(false);
    expect(
      shouldClearSelectedLineState({
        selectedLineState: lrclib,
        syncedActiveLineIndex: 1,
      }),
    ).toBe(true);
    expect(
      shouldClearSelectedLineState({
        selectedLineState: spotify,
        syncedActiveLineIndex: -1,
      }),
    ).toBe(false);
    expect(
      shouldClearSelectedLineState({
        selectedLineState: spotify,
        syncedActiveLineIndex: 1,
      }),
    ).toBe(true);
    expect(
      getVisibleActiveLineIndex({
        selectedLineIndex: 2,
        syncedActiveLineIndex: 1,
      }),
    ).toBe(2);
    expect(
      getVisibleActiveLineIndex({
        selectedLineIndex: null,
        syncedActiveLineIndex: 1,
      }),
    ).toBe(1);
  });

  test('derives seek and scrolling positions with boundaries', () => {
    expect(
      getSelectedPlaybackPositionMs({
        lyricsSource: 'lrclib',
        selectedLineIndex: 1,
        lines,
      }),
    ).toBe(4_000);
    expect(
      getSelectedPlaybackPositionMs({
        lyricsSource: 'spotify',
        selectedLineIndex: 1,
        lines,
      }),
    ).toBeNull();
    expect(
      getSelectedPlaybackPositionMs({
        lyricsSource: 'lrclib',
        selectedLineIndex: 9,
        lines,
      }),
    ).toBeNull();
    expect(
      calculateCenteredScrollTop({
        activeOffsetTop: 700,
        activeHeight: 80,
        containerHeight: 400,
        maxScrollTop: 900,
      }),
    ).toBe(540);
    expect(
      calculateCenteredScrollTop({
        activeOffsetTop: 0,
        activeHeight: 20,
        containerHeight: 400,
        maxScrollTop: 900,
      }),
    ).toBe(0);
    expect(
      calculateCenteredScrollTop({
        activeOffsetTop: 2_000,
        activeHeight: 20,
        containerHeight: 400,
        maxScrollTop: 900,
      }),
    ).toBe(900);
  });

  test('recognizes playback reset only with complete timestamps', () => {
    expect(
      shouldResetScrollTopOnPlaybackReset({
        previousPlaybackPositionMs: 4_000,
        playbackPositionMs: 500,
      }),
    ).toBe(true);
    expect(
      shouldResetScrollTopOnPlaybackReset({
        previousPlaybackPositionMs: null,
        playbackPositionMs: 0,
      }),
    ).toBe(false);
    expect(
      shouldResetScrollTopOnPlaybackReset({
        previousPlaybackPositionMs: 4_000,
        playbackPositionMs: null,
      }),
    ).toBe(false);
    expect(
      shouldResetScrollTopOnPlaybackReset({
        previousPlaybackPositionMs: 2_000,
        playbackPositionMs: 500,
      }),
    ).toBe(false);
  });
});
