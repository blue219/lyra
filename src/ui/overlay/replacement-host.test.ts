// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
  ensureReplacementHost,
  removeReplacementHosts,
  shouldMountLyricsExperience,
} from './replacement-host';

describe('replacement host', () => {
  test('reuses one host and removes stale hosts after Spotify replaces its container', () => {
    document.body.innerHTML = '<main></main><section></section>';
    const main = document.querySelector('main')!;
    const section = document.querySelector('section')!;
    const first = ensureReplacementHost(document, main);
    expect(ensureReplacementHost(document, main)).toBe(first);

    const second = ensureReplacementHost(document, section);
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
    expect(
      document.querySelectorAll('[data-lyra-replacement-host="true"]'),
    ).toHaveLength(1);

    removeReplacementHosts(document);
    expect(
      document.querySelectorAll('[data-lyra-replacement-host="true"]'),
    ).toHaveLength(0);
  });

  test('mounts on a lyrics route or when lyrics become visible', () => {
    expect(shouldMountLyricsExperience(true, false)).toBe(true);
    expect(shouldMountLyricsExperience(false, true)).toBe(true);
    expect(shouldMountLyricsExperience(false, false)).toBe(false);
  });
});
