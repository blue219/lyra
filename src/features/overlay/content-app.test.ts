import { describe, expect, test } from 'vitest';

import {
  calculateCenteredScrollTop,
  getReplacementActiveLineIndex,
  selectLyricsRequest,
  shouldMountLyricsExperience,
  shouldRequestVisibleSpotifyLyrics,
} from './content-app';
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

describe('shouldMountLyricsExperience', () => {
  test('mounts on the Spotify lyrics page even before Spotify lyric rows exist', () => {
    expect(shouldMountLyricsExperience(true, false)).toBe(true);
  });

  test('mounts when visible Spotify lyrics exist', () => {
    expect(shouldMountLyricsExperience(false, true)).toBe(true);
  });

  test('stays idle away from the Spotify lyrics page when lyrics are absent', () => {
    expect(shouldMountLyricsExperience(false, false)).toBe(false);
  });
});

describe('selectLyricsRequest', () => {
  test('uses Spotify lyric rows before LRCLIB fallback', () => {
    expect(selectLyricsRequest(spotifyLines, track)).toEqual({
      type: 'spotify',
      lines: spotifyLines,
    });
  });

  test('uses LRCLIB fallback when Spotify lyrics are missing and the track is known', () => {
    expect(selectLyricsRequest([], track)).toEqual({
      type: 'lrclib',
      track,
    });
  });

  test('returns none when neither Spotify lyrics nor the track are known', () => {
    expect(selectLyricsRequest([], null)).toEqual({ type: 'none' });
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
