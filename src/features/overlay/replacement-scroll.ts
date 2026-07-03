import { useEffect, useRef } from 'react';

import type { LyricsResult } from '../../shared/types';
import { calculateCenteredScrollTop, shouldResetScrollTopOnPlaybackReset } from './lyrics-flow';

const replacementLineSelector = '.lyra-replacement-line';
const replacementAutoScrollPauseMs = 2_500;

export function useReplacementAutoScroll({
  activeLineIndex,
  lyrics,
  playbackPositionMs,
  replacementHost,
}: {
  activeLineIndex: number;
  lyrics: LyricsResult;
  playbackPositionMs: number | null;
  replacementHost: HTMLElement | null;
}) {
  const previousPlaybackPositionMsRef = useRef<number | null>(null);
  const replacementAutoScrollPauseUntilMsRef = useRef(0);
  const isProgrammaticReplacementScrollRef = useRef(false);

  useEffect(() => {
    const scroller = replacementHost?.querySelector<HTMLElement>(
      '[data-lyra-replacement-scroll="true"]',
    );

    if (!scroller) {
      return;
    }

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

    return () => {
      scroller.removeEventListener('wheel', handleWheel);
      scroller.removeEventListener('pointerdown', handlePointerDown);
      scroller.removeEventListener('mousedown', handleMouseDown);
      scroller.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
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

    if (!scroller) {
      return;
    }

    if (shouldResetScrollTop) {
      scroller.scrollTop = 0;
      return;
    }

    if (
      shouldPauseReplacementAutoScroll({
        pauseUntilMs: replacementAutoScrollPauseUntilMsRef.current,
        nowMs: Date.now(),
      })
    ) {
      return;
    }

    const activeLine = scroller.querySelector<HTMLElement>(
      '[data-lyra-replacement-active="true"]',
    );

    if (!activeLine) {
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
  }, [activeLineIndex, lyrics, playbackPositionMs, replacementHost]);
}

export function keepReplacementLyricsInView(replacementHost: HTMLElement | null) {
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
  const horizontalScrollbarHeight = scroller.offsetHeight - scroller.clientHeight;
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
