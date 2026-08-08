// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
  keepReplacementLyricsInView,
  shouldPauseReplacementAutoScroll,
  shouldPauseReplacementAutoScrollOnMouseDown,
  shouldRefreshCacheSummaryOnOpen,
  shouldTrackManualReplacementScroll,
  shouldMountLyricsExperience,
} from './content-app';

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

describe('keepReplacementLyricsInView', () => {
  test('scrolls the replacement host back into view after lyric seeking', () => {
    const host = document.createElement('div');
    let called = false;

    host.scrollIntoView = () => {
      called = true;
    };

    keepReplacementLyricsInView(host);

    expect(called).toBe(true);
  });
});

describe('manual replacement scroll tracking', () => {
  test('pauses replacement auto-scroll while the user is still manually scrolling', () => {
    expect(
      shouldPauseReplacementAutoScroll({
        pauseUntilMs: 4_000,
        nowMs: 3_500,
      }),
    ).toBe(true);
  });

  test('resumes replacement auto-scroll after the manual scroll pause window ends', () => {
    expect(
      shouldPauseReplacementAutoScroll({
        pauseUntilMs: 4_000,
        nowMs: 4_001,
      }),
    ).toBe(false);
  });

  test('tracks pointer interaction on the scroller itself as manual scroll intent', () => {
    const scroller = document.createElement('section');

    expect(shouldTrackManualReplacementScroll(scroller, scroller)).toBe(true);
  });

  test('ignores lyric row clicks when deciding whether to pause auto-scroll', () => {
    const scroller = document.createElement('section');
    const lyricLine = document.createElement('div');

    lyricLine.className = 'lyra-replacement-line';
    scroller.append(lyricLine);

    expect(shouldTrackManualReplacementScroll(scroller, lyricLine)).toBe(false);
  });

  test('pauses auto-scroll as soon as the user presses the vertical scrollbar gutter', () => {
    const scroller = document.createElement('section');

    Object.defineProperty(scroller, 'clientWidth', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scroller, 'offsetWidth', {
      configurable: true,
      value: 216,
    });
    scroller.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
      }) as DOMRect;

    expect(
      shouldPauseReplacementAutoScrollOnMouseDown(
        scroller,
        new MouseEvent('mousedown', {
          clientX: 312,
          clientY: 120,
        }),
      ),
    ).toBe(true);
  });

  test('does not treat regular content clicks as scrollbar mouse presses', () => {
    const scroller = document.createElement('section');

    Object.defineProperty(scroller, 'clientWidth', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scroller, 'offsetWidth', {
      configurable: true,
      value: 216,
    });
    scroller.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
      }) as DOMRect;

    expect(
      shouldPauseReplacementAutoScrollOnMouseDown(
        scroller,
        new MouseEvent('mousedown', {
          clientX: 180,
          clientY: 120,
        }),
      ),
    ).toBe(false);
  });
});

describe('cache summary refresh', () => {
  test('refreshes cache summary only when the settings panel transitions from closed to open', () => {
    expect(
      shouldRefreshCacheSummaryOnOpen({
        wasOpen: false,
        isOpen: true,
      }),
    ).toBe(true);
    expect(
      shouldRefreshCacheSummaryOnOpen({
        wasOpen: true,
        isOpen: true,
      }),
    ).toBe(false);
    expect(
      shouldRefreshCacheSummaryOnOpen({
        wasOpen: true,
        isOpen: false,
      }),
    ).toBe(false);
  });
});
