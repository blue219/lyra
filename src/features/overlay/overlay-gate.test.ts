import { describe, expect, test, vi } from 'vitest';

import { createLyricsOverlayGate } from './overlay-gate';

describe('createLyricsOverlayGate', () => {
  test('does not mount until lyrics become visible', () => {
    let lyricsVisible = false;
    let notifyDomChanged = () => {};
    const remove = vi.fn();
    const mountOverlay = vi.fn(() => ({ remove }));
    const gate = createLyricsOverlayGate({
      hasVisibleLyrics: () => lyricsVisible,
      mountOverlay,
      observeDomChanges: (listener) => {
        notifyDomChanged = listener;
        return vi.fn();
      },
    });

    gate.start();

    expect(mountOverlay).not.toHaveBeenCalled();

    lyricsVisible = true;
    notifyDomChanged();

    expect(mountOverlay).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  test('removes the mounted overlay when lyrics stop being visible', () => {
    let lyricsVisible = true;
    let notifyDomChanged = () => {};
    const remove = vi.fn();
    const gate = createLyricsOverlayGate({
      hasVisibleLyrics: () => lyricsVisible,
      mountOverlay: () => ({ remove }),
      observeDomChanges: (listener) => {
        notifyDomChanged = listener;
        return vi.fn();
      },
    });

    gate.start();
    lyricsVisible = false;
    notifyDomChanged();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  test('cleans up inactive overlay hosts when lyrics are not visible', () => {
    let notifyDomChanged = () => {};
    const removeInactiveOverlay = vi.fn();
    const gate = createLyricsOverlayGate({
      hasVisibleLyrics: () => false,
      mountOverlay: vi.fn(() => ({ remove: vi.fn() })),
      observeDomChanges: (listener) => {
        notifyDomChanged = listener;
        return vi.fn();
      },
      removeInactiveOverlay,
    });

    gate.start();
    notifyDomChanged();

    expect(removeInactiveOverlay).toHaveBeenCalledTimes(2);
  });

  test('mounts only once while lyrics stay visible', () => {
    let notifyDomChanged = () => {};
    const mountOverlay = vi.fn(() => ({ remove: vi.fn() }));
    const gate = createLyricsOverlayGate({
      hasVisibleLyrics: () => true,
      mountOverlay,
      observeDomChanges: (listener) => {
        notifyDomChanged = listener;
        return vi.fn();
      },
    });

    gate.start();
    notifyDomChanged();
    notifyDomChanged();

    expect(mountOverlay).toHaveBeenCalledTimes(1);
    expect(gate.isMounted()).toBe(true);
  });

  test('can mount again after lyrics disappear and reappear', () => {
    let lyricsVisible = true;
    let notifyDomChanged = () => {};
    const firstRemove = vi.fn();
    const secondRemove = vi.fn();
    const mountOverlay = vi
      .fn()
      .mockReturnValueOnce({ remove: firstRemove })
      .mockReturnValueOnce({ remove: secondRemove });
    const gate = createLyricsOverlayGate({
      hasVisibleLyrics: () => lyricsVisible,
      mountOverlay,
      observeDomChanges: (listener) => {
        notifyDomChanged = listener;
        return vi.fn();
      },
    });

    gate.start();
    lyricsVisible = false;
    notifyDomChanged();
    lyricsVisible = true;
    notifyDomChanged();

    expect(mountOverlay).toHaveBeenCalledTimes(2);
    expect(firstRemove).toHaveBeenCalledTimes(1);
    expect(secondRemove).not.toHaveBeenCalled();
  });
});
