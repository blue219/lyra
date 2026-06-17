import { describe, expect, test } from 'vitest';

import {
  calculateCenteredScrollTop,
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
import type { LyricLine, TrackIdentity } from '../../shared/types';

const spotifyLines: LyricLine[] = [{ timeMs: 0, original: 'Hello' }];
const track: TrackIdentity = {
  title: 'Stand By Me',
  artists: ['Ben E. King'],
  durationSeconds: 180,
};

describe('shouldRequestVisibleSpotifyLyrics', () => {
  test('does not request lyrics when Spotify lyrics are not visible', () => {
    expect(shouldRequestVisibleSpotifyLyrics([])).toBe(false);
  });
});

describe('selectLyricsRequest', () => {
  test('uses Spotify lyric rows before LRCLIB fallback', () => {
    expect(selectLyricsRequest(spotifyLines, track, false)).toEqual({
      type: 'spotify',
      lines: spotifyLines,
    });
  });

  test('prefers LRCLIB when Spotify lyrics are visible but unsynced', () => {
    expect(selectLyricsRequest(spotifyLines, track, true)).toEqual({
      type: 'lrclib',
      track,
    });
  });

  test('uses LRCLIB fallback when Spotify lyrics are missing and the track is known', () => {
    expect(selectLyricsRequest([], track, false)).toEqual({
      type: 'lrclib',
      track,
    });
  });

  test('returns none when neither Spotify lyrics nor the track are known', () => {
    expect(selectLyricsRequest([], null, false)).toEqual({ type: 'none' });
  });

  test('keeps Spotify lyrics when they are unsynced and no track metadata is available', () => {
    expect(selectLyricsRequest(spotifyLines, null, true)).toEqual({
      type: 'spotify',
      lines: spotifyLines,
    });
  });
});

describe('createLyricsRequestKey', () => {
  test('defers lyrics requests until settings finish loading', () => {
    expect(
      createLyricsRequestKey(
        {
          type: 'lrclib',
          track,
        },
        'zh-CN',
        false,
      ),
    ).toBe('pending-settings');
  });

  test('uses the resolved settings language after settings finish loading', () => {
    expect(
      createLyricsRequestKey(
        {
          type: 'lrclib',
          track,
        },
        'zh-CN',
        true,
      ),
    ).toBe('lrclib__zh-CN__Stand By Me__Ben E. King____180');
  });
});

describe('shouldStartLyricsRequest', () => {
  test('waits for persisted settings before starting a lyrics request', () => {
    expect(
      shouldStartLyricsRequest({
        selection: {
          type: 'lrclib',
          track,
        },
        settingsLoaded: false,
      }),
    ).toBe(false);
  });

  test('starts lyrics requests after settings are loaded', () => {
    expect(
      shouldStartLyricsRequest({
        selection: {
          type: 'lrclib',
          track,
        },
        settingsLoaded: true,
      }),
    ).toBe(true);
  });

  test('does not start lyrics requests when no source is selected', () => {
    expect(
      shouldStartLyricsRequest({
        selection: {
          type: 'none',
        },
        settingsLoaded: true,
      }),
    ).toBe(false);
  });
});

describe('loadLyricsSelection', () => {
  test('starts Spotify requests with lyrics loading before switching to translation loading', async () => {
    const snapshots: Array<{ phase: string; lineCount: number }> = [];

    const result = await loadLyricsSelection({
      selection: {
        type: 'spotify',
        lines: spotifyLines,
      },
      targetLanguage: 'zh-CN',
      requestOriginalLyricsFn: async () => {
        throw new Error('Spotify flow should not fetch fallback lyrics first');
      },
      requestTranslatedLyricsFn: async (lines) => ({
        status: 'bilingual',
        source: 'spotify',
        lines: lines.map((line) => ({
          ...line,
          translated: '你好',
          translatedLanguage: 'zh-CN',
        })),
      }),
      onPhaseChange: (snapshot) => {
        snapshots.push({
          phase: snapshot.phase,
          lineCount: snapshot.lyrics.lines.length,
        });
      },
    });

    expect(snapshots).toEqual([
      { phase: 'loading-lyrics', lineCount: 0 },
      { phase: 'loading-translation', lineCount: 1 },
    ]);
    expect(result.phase).toBe('ready');
    expect(result.lyrics.status).toBe('bilingual');
  });

  test('starts LRCLIB requests with lyrics loading and then switches to translation loading', async () => {
    const snapshots: Array<{ phase: string; lineCount: number }> = [];

    const result = await loadLyricsSelection({
      selection: {
        type: 'lrclib',
        track,
      },
      targetLanguage: 'zh-CN',
      requestOriginalLyricsFn: async () => ({
        status: 'monolingual',
        source: 'lrclib',
        lines: [
          { timeMs: 0, original: 'First' },
          { timeMs: 1_000, original: 'Second' },
        ],
      }),
      requestTranslatedLyricsFn: async (lines) => ({
        status: 'bilingual',
        source: 'lrclib',
        lines: lines.map((line, index) => ({
          ...line,
          translated: index === 0 ? '第一' : '第二',
          translatedLanguage: 'zh-CN',
        })),
      }),
      onPhaseChange: (snapshot) => {
        snapshots.push({
          phase: snapshot.phase,
          lineCount: snapshot.lyrics.lines.length,
        });
      },
    });

    expect(snapshots).toEqual([
      { phase: 'loading-lyrics', lineCount: 0 },
      { phase: 'loading-translation', lineCount: 2 },
    ]);
    expect(result.phase).toBe('ready');
    expect(result.lyrics.status).toBe('bilingual');
  });

  test('skips LRCLIB translation when fetched lyrics already match the target language', async () => {
    const snapshots: Array<{ phase: string; lineCount: number }> = [];

    const result = await loadLyricsSelection({
      selection: {
        type: 'lrclib',
        track,
      },
      targetLanguage: 'ja-JP',
      requestOriginalLyricsFn: async () => ({
        status: 'monolingual',
        source: 'lrclib',
        sourceLanguage: 'ja-JP',
        lines: [
          { timeMs: 0, original: '最初' },
          { timeMs: 1_000, original: '二番目' },
        ],
      }),
      requestTranslatedLyricsFn: async () => {
        throw new Error('Same-language LRCLIB lyrics should not request translation');
      },
      onPhaseChange: (snapshot) => {
        snapshots.push({
          phase: snapshot.phase,
          lineCount: snapshot.lyrics.lines.length,
        });
      },
    });

    expect(snapshots).toEqual([{ phase: 'loading-lyrics', lineCount: 0 }]);
    expect(result).toEqual({
      phase: 'ready',
      lyrics: {
        status: 'monolingual',
        source: 'lrclib',
        sourceLanguage: 'ja-JP',
        lines: [
          { timeMs: 0, original: '最初' },
          { timeMs: 1_000, original: '二番目' },
        ],
      },
    });
  });

  test('stops LRCLIB requests at unavailable without falling back to the old empty-state flow', async () => {
    const snapshots: Array<{ phase: string; lineCount: number }> = [];

    const result = await loadLyricsSelection({
      selection: {
        type: 'lrclib',
        track,
      },
      targetLanguage: 'zh-CN',
      requestOriginalLyricsFn: async () => ({
        status: 'unavailable',
        source: 'lrclib',
        lines: [],
      }),
      requestTranslatedLyricsFn: async () => {
        throw new Error('Unavailable LRCLIB lyrics should not request translation');
      },
      onPhaseChange: (snapshot) => {
        snapshots.push({
          phase: snapshot.phase,
          lineCount: snapshot.lyrics.lines.length,
        });
      },
    });

    expect(snapshots).toEqual([{ phase: 'loading-lyrics', lineCount: 0 }]);
    expect(result.phase).toBe('unavailable');
    expect(result.lyrics.status).toBe('unavailable');
  });
});

describe('getReplacementActiveLineIndex', () => {
  test('uses Spotify active line when Spotify provides the lyrics', () => {
    expect(
      getReplacementActiveLineIndex({
        lyricsSource: 'spotify',
        spotifyActiveLineIndex: 2,
        lines: [],
        playbackPositionMs: 0,
      }),
    ).toBe(2);
  });

  test('uses playback time when LRCLIB provides synced lyrics', () => {
    expect(
      getReplacementActiveLineIndex({
        lyricsSource: 'lrclib',
        spotifyActiveLineIndex: -1,
        playbackPositionMs: 5_000,
        lines: [
          { timeMs: 0, original: 'First' },
          { timeMs: 4_000, original: 'Second' },
          { timeMs: 8_000, original: 'Third' },
        ],
      }),
    ).toBe(1);
  });
});

describe('getSelectedPlaybackPositionMs', () => {
  test('uses the selected LRCLIB line time for immediate highlight updates', () => {
    expect(
      getSelectedPlaybackPositionMs({
        lyricsSource: 'lrclib',
        selectedLineIndex: 1,
        lines: [
          { timeMs: 0, original: 'First' },
          { timeMs: 4_000, original: 'Second' },
        ],
      }),
    ).toBe(4_000);
  });

  test('does not invent playback time for Spotify-sourced lyrics', () => {
    expect(
      getSelectedPlaybackPositionMs({
        lyricsSource: 'spotify',
        selectedLineIndex: 1,
        lines: [
          { timeMs: 0, original: 'First' },
          { timeMs: 1, original: 'Second' },
        ],
      }),
    ).toBeNull();
  });
});

describe('getVisibleActiveLineIndex', () => {
  test('uses the selected Lyra line instead of the synced Spotify line', () => {
    expect(
      getVisibleActiveLineIndex({
        selectedLineIndex: 5,
        syncedActiveLineIndex: 2,
      }),
    ).toBe(5);
  });

  test('falls back to the synced active line when no Lyra line is selected', () => {
    expect(
      getVisibleActiveLineIndex({
        selectedLineIndex: null,
        syncedActiveLineIndex: 2,
      }),
    ).toBe(2);
  });
});

describe('selected line state', () => {
  test('clears the temporary LRCLIB selection once synced playback reaches the selected line', () => {
    const state = getInitialSelectedLineState({
      selectedLineIndex: 4,
      lyricsSource: 'lrclib',
      syncedActiveLineIndex: 1,
    });

    expect(
      shouldClearSelectedLineState({
        selectedLineState: state,
        syncedActiveLineIndex: 4,
      }),
    ).toBe(true);
  });

  test('clears the temporary Spotify selection once Spotify active sync moves away from the original line', () => {
    const state = getInitialSelectedLineState({
      selectedLineIndex: 6,
      lyricsSource: 'spotify',
      syncedActiveLineIndex: 2,
    });

    expect(
      shouldClearSelectedLineState({
        selectedLineState: state,
        syncedActiveLineIndex: 6,
      }),
    ).toBe(true);
  });

  test('keeps using synced highlighting when there is no temporary selection', () => {
    expect(getSelectedLineIndex(null)).toBeNull();
  });
});

describe('calculateCenteredScrollTop', () => {
  test('centers the active line inside the replacement lyrics scroller', () => {
    expect(
      calculateCenteredScrollTop({
        activeOffsetTop: 700,
        activeHeight: 80,
        containerHeight: 400,
        maxScrollTop: 900,
      }),
    ).toBe(540);
  });

  test('clamps the centered position to the top and bottom scroll bounds', () => {
    expect(
      calculateCenteredScrollTop({
        activeOffsetTop: 40,
        activeHeight: 80,
        containerHeight: 400,
        maxScrollTop: 900,
      }),
    ).toBe(0);

    expect(
      calculateCenteredScrollTop({
        activeOffsetTop: 1_100,
        activeHeight: 80,
        containerHeight: 400,
        maxScrollTop: 900,
      }),
    ).toBe(900);
  });
});

describe('shouldResetScrollTopOnPlaybackReset', () => {
  test('resets to the top when playback jumps from later in the song back to the start', () => {
    expect(
      shouldResetScrollTopOnPlaybackReset({
        previousPlaybackPositionMs: 92_000,
        playbackPositionMs: 0,
      }),
    ).toBe(true);
  });

  test('does not reset to the top during normal forward playback updates', () => {
    expect(
      shouldResetScrollTopOnPlaybackReset({
        previousPlaybackPositionMs: 12_000,
        playbackPositionMs: 13_000,
      }),
    ).toBe(false);
  });
});
