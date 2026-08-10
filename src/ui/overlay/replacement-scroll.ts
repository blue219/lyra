import { useEffect, useRef, useState } from 'react';

import type { LyricsResult } from '@/src/domain/model';
import {
  calculateCenteredScrollTop,
  calculateLastLineBottomPadding,
  shouldResetScrollTopOnPlaybackReset,
} from '@/src/application/lyrics-flow';

const replacementLineSelector = '.lyra-replacement-line';
const replacementAutoScrollPauseMs = 2_500;

export function useReplacementAutoScroll({
  activeLineIndex,
  lyrics,
  playbackPositionMs,
  replacementHost,
  scrollRequestId,
}: {
  activeLineIndex: number;
  lyrics: LyricsResult;
  playbackPositionMs: number | null;
  replacementHost: HTMLElement | null;
  scrollRequestId: number;
}) {
  const previousPlaybackPositionMsRef = useRef<number | null>(null);
  const previousScrollRequestIdRef = useRef(scrollRequestId);
  const replacementAutoScrollPauseUntilMsRef = useRef(0);
  const isProgrammaticReplacementScrollRef = useRef(false);
  const [scrollerHeight, setScrollerHeight] = useState<number | null>(null);

  useEffect(() => {
    const scroller = replacementHost?.querySelector<HTMLElement>(
      '[data-lyra-replacement-scroll="true"]',
    );

    if (!scroller) {
      return;
    }

    const updateScrollerHeight = () => {
      setScrollerHeight((currentHeight) =>
        currentHeight === scroller.clientHeight
          ? currentHeight
          : scroller.clientHeight,
      );
    };
    let isPointerScrolling = false;

    const pauseReplacementAutoScroll = () => {
      replacementAutoScrollPauseUntilMsRef.current =
        Date.now() + replacementAutoScrollPauseMs;
    };

    const handleWheel = () => {
      pauseReplacementAutoScroll();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!shouldTrackManualReplacementScroll(scroller, event.target)) {
        return;
      }

      isPointerScrolling = true;
      pauseReplacementAutoScroll();
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!shouldPauseReplacementAutoScrollOnMouseDown(scroller, event)) {
        return;
      }

      isPointerScrolling = true;
      pauseReplacementAutoScroll();
    };

    const handlePointerUp = () => {
      if (!isPointerScrolling) {
        return;
      }

      isPointerScrolling = false;
      pauseReplacementAutoScroll();
    };

    const handleScroll = () => {
      if (isProgrammaticReplacementScrollRef.current) {
        isProgrammaticReplacementScrollRef.current = false;
        return;
      }

      if (isPointerScrolling) {
        pauseReplacementAutoScroll();
      }
    };

    scroller.addEventListener('wheel', handleWheel, { passive: true });
    scroller.addEventListener('pointerdown', handlePointerDown);
    scroller.addEventListener('mousedown', handleMouseDown);
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mouseup', handlePointerUp);
    updateScrollerHeight();

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateScrollerHeight);
    resizeObserver?.observe(scroller);

    return () => {
      scroller.removeEventListener('wheel', handleWheel);
      scroller.removeEventListener('pointerdown', handlePointerDown);
      scroller.removeEventListener('mousedown', handleMouseDown);
      scroller.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
      resizeObserver?.disconnect();
    };
  }, [replacementHost]);

  useEffect(() => {
    const scroller = replacementHost?.querySelector<HTMLElement>(
      '[data-lyra-replacement-scroll="true"]',
    );
    const shouldResetScrollTop = shouldResetScrollTopOnPlaybackReset({
      previousPlaybackPositionMs: previousPlaybackPositionMsRef.current,
      playbackPositionMs,
    });

    previousPlaybackPositionMsRef.current = playbackPositionMs;
    const isExplicitScrollRequest =
      previousScrollRequestIdRef.current !== scrollRequestId;

    previousScrollRequestIdRef.current = scrollRequestId;

    if (!scroller) {
      return;
    }

    if (shouldResetScrollTop) {
      scroller.scrollTop = 0;
      return;
    }

    const activeLine = scroller.querySelector<HTMLElement>(
      '[data-lyra-replacement-active="true"]',
    );
    const lyricLines = scroller.querySelectorAll<HTMLElement>(
      replacementLineSelector,
    );
    const lastLine = lyricLines.item(lyricLines.length - 1);
    const lyricsShell = scroller.querySelector<HTMLElement>(
      '[data-lyra-aurora-shell="true"]',
    );

    if (lyricsShell) {
      if (lastLine) {
        const currentBottomPadding =
          Number.parseFloat(lyricsShell.style.paddingBottom) || 0;
        const contentHeightWithoutReservedPadding = Math.max(
          0,
          scroller.scrollHeight - currentBottomPadding,
        );
        const nextBottomPadding = calculateLastLineBottomPadding({
          activeOffsetTop: lastLine.offsetTop,
          activeHeight: lastLine.offsetHeight,
          containerHeight: scroller.clientHeight,
          contentHeight: contentHeightWithoutReservedPadding,
        });

        // Update the final follow boundary without briefly collapsing the current scroll range.
        if (currentBottomPadding !== nextBottomPadding) {
          lyricsShell.style.paddingBottom = `${nextBottomPadding}px`;
        }
      } else if (lyricsShell.style.paddingBottom !== '0px') {
        lyricsShell.style.paddingBottom = '0px';
      }
    }

    if (!activeLine) {
      return;
    }

    if (
      !isExplicitScrollRequest &&
      shouldPauseReplacementAutoScroll({
        pauseUntilMs: replacementAutoScrollPauseUntilMsRef.current,
        nowMs: Date.now(),
      })
    ) {
      return;
    }

    const scrollTop = calculateCenteredScrollTop({
      activeOffsetTop: activeLine.offsetTop,
      activeHeight: activeLine.offsetHeight,
      containerHeight: scroller.clientHeight,
      maxScrollTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
    });

    if (typeof scroller.scrollTo === 'function') {
      isProgrammaticReplacementScrollRef.current = true;
      scroller.scrollTo({
        top: scrollTop,
        behavior: 'smooth',
      });
      return;
    }

    isProgrammaticReplacementScrollRef.current = true;
    scroller.scrollTop = scrollTop;
  }, [
    activeLineIndex,
    lyrics,
    playbackPositionMs,
    replacementHost,
    scrollerHeight,
    scrollRequestId,
  ]);
}

export function keepReplacementLyricsInView(
  replacementHost: HTMLElement | null,
) {
  replacementHost?.scrollIntoView({
    block: 'start',
  });
}

export function shouldPauseReplacementAutoScroll({
  pauseUntilMs,
  nowMs,
}: {
  pauseUntilMs: number;
  nowMs: number;
}): boolean {
  return pauseUntilMs > nowMs;
}

export function shouldTrackManualReplacementScroll(
  scroller: HTMLElement,
  eventTarget: EventTarget | null,
): boolean {
  if (!(eventTarget instanceof Element)) {
    return false;
  }

  // Clicking a lyric row is a seek interaction, not a request to freeze lyric follow mode.
  if (eventTarget.closest(replacementLineSelector)) {
    return false;
  }

  return scroller.contains(eventTarget);
}

export function shouldPauseReplacementAutoScrollOnMouseDown(
  scroller: HTMLElement,
  event: MouseEvent,
): boolean {
  const verticalScrollbarWidth = scroller.offsetWidth - scroller.clientWidth;
  const horizontalScrollbarHeight =
    scroller.offsetHeight - scroller.clientHeight;
  const { left, top } = scroller.getBoundingClientRect();
  const offsetX = event.clientX - left;
  const offsetY = event.clientY - top;

  if (verticalScrollbarWidth > 0 && offsetX >= scroller.clientWidth) {
    return true;
  }

  // Native scrollbar presses may bypass pointer events, so detect gutter presses from coordinates.
  if (horizontalScrollbarHeight > 0 && offsetY >= scroller.clientHeight) {
    return true;
  }

  return false;
}
