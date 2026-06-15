// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
  keepReplacementLyricsInView,
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
