// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test, vi } from 'vitest';

import { useReplacementAutoScroll } from './replacement-scroll';
import type { LyricsResult } from '@/src/domain/model';

const lyrics: LyricsResult = {
  status: 'available',
  source: 'spotify',
  lines: [
    { timeMs: 0, original: 'First' },
    { timeMs: 1_000, original: 'Current' },
    { timeMs: 2_000, original: 'Last' },
  ],
};

describe('useReplacementAutoScroll', () => {
  test('returns the current line to its follow position when it is selected again', () => {
    const { replacementHost, scroller, scrollTo } = createReplacementHost();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <AutoScrollHarness
          replacementHost={replacementHost}
          scrollRequestId={0}
        />,
      );
    });

    scrollTo.mockClear();
    scroller.dispatchEvent(new Event('wheel'));

    act(() => {
      root.render(
        <AutoScrollHarness
          replacementHost={replacementHost}
          scrollRequestId={1}
        />,
      );
    });

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 240 });

    act(() => {
      root.unmount();
    });
  });

  test('keeps the final line boundary reserved while another line is active', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    let notifyResize: () => void = () => {};

    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }

      disconnect() {}

      observe() {}
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverMock,
    });

    const { replacementHost, scrollTo, setClientHeight, shell } =
      createFinalLineReplacementHost();
    const container = document.createElement('div');
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <AutoScrollHarness
            activeLineIndex={0}
            lyricsResult={finalLineLyrics}
            replacementHost={replacementHost}
            scrollRequestId={0}
          />,
        );
      });

      expect(shell.style.paddingBottom).toBe('160px');

      scrollTo.mockClear();
      setClientHeight(300);

      act(() => {
        notifyResize();
      });

      expect(shell.style.paddingBottom).toBe('110px');
      expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 90 });
    } finally {
      act(() => {
        root.unmount();
      });
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        value: originalResizeObserver,
      });
    }
  });

  test('does not collapse the reserved final boundary when a line is selected', () => {
    const { replacementHost, shell } = createFinalLineReplacementHost();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <AutoScrollHarness
          activeLineIndex={0}
          lyricsResult={finalLineLyrics}
          replacementHost={replacementHost}
          scrollRequestId={0}
        />,
      );
    });

    const styleObserver = new MutationObserver(() => undefined);
    styleObserver.observe(shell, {
      attributeFilter: ['style'],
      attributes: true,
    });

    act(() => {
      root.render(
        <AutoScrollHarness
          activeLineIndex={1}
          lyricsResult={finalLineLyrics}
          replacementHost={replacementHost}
          scrollRequestId={1}
        />,
      );
    });

    expect(styleObserver.takeRecords()).toHaveLength(0);

    styleObserver.disconnect();
    act(() => {
      root.unmount();
    });
  });
});

function AutoScrollHarness({
  activeLineIndex = 1,
  lyricsResult = lyrics,
  replacementHost,
  scrollRequestId,
}: {
  activeLineIndex?: number;
  lyricsResult?: LyricsResult;
  replacementHost: HTMLElement;
  scrollRequestId: number;
}) {
  useReplacementAutoScroll({
    activeLineIndex,
    lyrics: lyricsResult,
    playbackPositionMs: null,
    replacementHost,
    scrollRequestId,
  });

  return null;
}

const finalLineLyrics: LyricsResult = {
  status: 'available',
  source: 'spotify',
  lines: [
    { timeMs: 0, original: 'First' },
    { timeMs: 1_000, original: 'Last' },
  ],
};

function createReplacementHost() {
  const replacementHost = document.createElement('div');
  const scroller = document.createElement('section');
  const activeLine = document.createElement('div');
  const scrollTo = vi.fn();

  scroller.dataset.lyraReplacementScroll = 'true';
  activeLine.dataset.lyraReplacementActive = 'true';
  scroller.append(activeLine);
  replacementHost.append(scroller);

  Object.defineProperties(scroller, {
    clientHeight: { value: 400 },
    scrollHeight: { value: 1_200 },
    scrollTo: { value: scrollTo },
  });
  Object.defineProperties(activeLine, {
    offsetHeight: { value: 80 },
    offsetTop: { value: 400 },
  });

  return { replacementHost, scroller, scrollTo };
}

function createFinalLineReplacementHost() {
  const replacementHost = document.createElement('div');
  const scroller = document.createElement('section');
  const shell = document.createElement('div');
  const activeLine = document.createElement('div');
  const lastLine = document.createElement('div');
  const scrollTo = vi.fn();
  let clientHeight = 400;

  scroller.dataset.lyraReplacementScroll = 'true';
  shell.dataset.lyraAuroraShell = 'true';
  activeLine.className = 'lyra-replacement-line';
  activeLine.dataset.lyraReplacementActive = 'true';
  lastLine.className = 'lyra-replacement-line';
  shell.append(activeLine, lastLine);
  scroller.append(shell);
  replacementHost.append(scroller);

  Object.defineProperties(scroller, {
    clientHeight: { get: () => clientHeight },
    scrollHeight: {
      get: () => 880 + Number.parseFloat(shell.style.paddingBottom || '0'),
    },
    scrollTo: { value: scrollTo },
  });
  Object.defineProperties(activeLine, {
    offsetHeight: { value: 80 },
    offsetTop: { value: 200 },
  });
  Object.defineProperties(lastLine, {
    offsetHeight: { value: 80 },
    offsetTop: { value: 800 },
  });

  return {
    replacementHost,
    scrollTo,
    setClientHeight: (nextHeight: number) => {
      clientHeight = nextHeight;
    },
    shell,
  };
}
