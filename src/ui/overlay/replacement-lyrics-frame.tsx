import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { AuroraBackground } from './aurora-background';
import type { OverlayPhase } from '@/src/application/lyrics-flow';
import {
  fixedCoverPalette,
  type CoverPalette,
} from '@/src/domain/cover-palette';

export const loadingSkeletonGroupCount = 5;
export const lyricsContentMaxWidth = '1024px';
export const lyricsHorizontalPadding = 'clamp(20px, 4vw, 48px)';
export const defaultLyricsPadding = `64px ${lyricsHorizontalPadding} 0`;
export const loadingLyricsPadding = `var(--lyra-lyrics-loading-top, 24px) ${lyricsHorizontalPadding} 64px`;
export const skeletonOriginalWidth = '66.6667%';
export const skeletonTranslationWidth = '33.3333%';

const replacementViewportHeight = 'calc(100vh - 96px)';
const spotifyPlayerSelector = '[data-testid="now-playing-bar"]';
const coverPaletteTransitionMs = 350;
const skeletonHighlightGradient =
  'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.08) 18%, rgba(255, 255, 255, 0.42) 50%, rgba(255, 255, 255, 0.08) 82%, rgba(255, 255, 255, 0) 100%)';
const skeletonAnimationStyles = `
  @keyframes lyra-skeleton-sweep {
    0% {
      transform: translateX(-160%);
    }

    100% {
      transform: translateX(460%);
    }
  }

  @keyframes lyra-loading-pulse {
    0%,
    100% {
      opacity: 0.72;
      transform: scaleY(0.82);
    }

    50% {
      opacity: 1;
      transform: scaleY(1);
    }
  }
`;

export function getSkeletonLineStyle(height: string, width: string) {
  return {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: '9999px',
    height,
    maxWidth: '100%',
    overflow: 'hidden',
    position: 'relative',
    width,
  } as const;
}

export function getSkeletonBeamStyle() {
  return {
    animation: 'lyra-skeleton-sweep 1.2s linear infinite',
    backgroundImage: skeletonHighlightGradient,
    borderRadius: '9999px',
    boxShadow: '0 0 14px rgba(255, 255, 255, 0.14)',
    height: '100%',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    transform: 'translateX(-160%)',
    width: '28%',
  } as const;
}

export function getStatusTextStyle(): CSSProperties {
  return {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    margin: 0,
    textTransform: 'uppercase',
  };
}

export function calculateLyricsViewportHeight({
  fallbackHeight,
  lyricsTop,
  playerTop,
}: {
  fallbackHeight: string;
  lyricsTop: number;
  playerTop: number | null;
}): string {
  if (playerTop === null || playerTop <= lyricsTop) {
    return fallbackHeight;
  }

  return `${Math.floor(playerTop - lyricsTop)}px`;
}

export function StatusLabel({
  label,
  phase,
}: {
  label: string;
  phase: OverlayPhase;
}) {
  const isLoading =
    phase === 'loading-lyrics' || phase === 'loading-translation';

  if (!isLoading) {
    return <p style={getStatusTextStyle()}>{label}</p>;
  }

  return (
    <div
      className="lyra-loading-status"
      style={{
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div
        aria-hidden="true"
        className="lyra-loading-mark"
        style={{
          alignItems: 'center',
          display: 'flex',
          filter: 'drop-shadow(0 0 18px rgba(30, 215, 96, 0.22))',
          gap: '6px',
          paddingLeft: '2px',
          paddingRight: '2px',
        }}
      >
        {[8, 18, 30, 18, 8].map((height, index) => (
          <span
            key={`loading-mark-bar-${height}-${index}`}
            className="lyra-loading-mark-bar"
            style={{
              animation: `lyra-loading-pulse 1.4s ease-in-out ${index * 120}ms infinite`,
              background:
                'linear-gradient(180deg, rgba(88, 255, 141, 1) 0%, rgba(30, 215, 96, 0.96) 100%)',
              borderRadius: '9999px',
              boxShadow: '0 0 18px rgba(30, 215, 96, 0.28)',
              display: 'block',
              height: `${height}px`,
              transformOrigin: 'center',
              width:
                index === 2
                  ? '10px'
                  : index === 1 || index === 3
                    ? '8px'
                    : '6px',
            }}
          />
        ))}
      </div>
      <p
        style={{
          color: 'rgba(255, 255, 255, 0.94)',
          fontSize: '0.96rem',
          fontWeight: 500,
          letterSpacing: '0',
          lineHeight: 1.2,
          margin: 0,
          textTransform: 'none',
        }}
      >
        {label}
      </p>
    </div>
  );
}

export function ReplacementLyricsFrame({
  children,
  contentGap,
  coverPalette = fixedCoverPalette,
  dynamicBackground,
  padding,
  selectable = false,
}: {
  children: ReactNode;
  contentGap: string;
  coverPalette?: CoverPalette;
  dynamicBackground: boolean;
  padding: string;
  selectable?: boolean;
}) {
  const displayedCoverPalette = useInterpolatedCoverPalette(coverPalette);
  const frameRef = useRef<HTMLElement>(null);
  const [viewportHeight, setViewportHeight] = useState(
    replacementViewportHeight,
  );
  const frameHeight = `var(--lyra-viewport-height, ${viewportHeight})`;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const player = document.querySelector<HTMLElement>(spotifyPlayerSelector);

    if (!frame || !player) {
      return;
    }

    // Spotify's player height varies by layout, so it defines the lyrics viewport edge.
    const updateViewportHeight = () => {
      const nextHeight = calculateLyricsViewportHeight({
        fallbackHeight: replacementViewportHeight,
        lyricsTop: frame.getBoundingClientRect().top,
        playerTop: player.getBoundingClientRect().top,
      });

      setViewportHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', updateViewportHeight);
    }

    const resizeObserver = new ResizeObserver(updateViewportHeight);
    resizeObserver.observe(player);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <section
      className="lyra-replacement-lyrics"
      data-lyra-replacement-lyrics="true"
      data-lyra-replacement-scroll="true"
      ref={frameRef}
      style={{
        backgroundColor: '#121212',
        boxSizing: 'border-box',
        color: '#ffffff',
        height: frameHeight,
        overflowX: 'hidden',
        overflowY: 'auto',
        position: 'relative',
        scrollBehavior: 'smooth',
        width: '100%',
        ...(selectable
          ? {
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }
          : null),
      }}
    >
      <style>{skeletonAnimationStyles}</style>
      <AuroraLayer
        colorStops={displayedCoverPalette}
        dynamicBackground={dynamicBackground}
        viewportHeight={frameHeight}
      />
      <div
        data-lyra-aurora-shell="true"
        style={{
          boxSizing: 'border-box',
          minHeight: '100%',
          padding,
          position: 'relative',
          width: '100%',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: contentGap,
            margin: '0 auto',
            maxWidth: lyricsContentMaxWidth,
            position: 'relative',
            width: '100%',
            zIndex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

function AuroraLayer({
  colorStops,
  dynamicBackground,
  viewportHeight,
}: {
  colorStops: CoverPalette;
  dynamicBackground: boolean;
  viewportHeight: string;
}) {
  const [light, middle, dark] = colorStops;
  return (
    <div
      aria-hidden="true"
      data-lyra-aurora="true"
      style={{
        height: viewportHeight,
        marginBottom: `calc(-1 * ${viewportHeight})`,
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'sticky',
        top: 0,
        width: '100%',
        zIndex: 0,
      }}
    >
      <div
        data-lyra-aurora-static="true"
        style={{
          background: `radial-gradient(circle at 18% 12%, ${toRgba(light, 0.2)} 0%, ${toRgba(light, 0.06)} 18%, ${toRgba(light, 0)} 42%), radial-gradient(circle at 76% 10%, ${toRgba(dark, 0.24)} 0%, ${toRgba(dark, 0.08)} 24%, ${toRgba(dark, 0)} 52%), linear-gradient(180deg, rgba(17, 12, 24, 0.94) 0%, rgba(14, 16, 22, 0.97) 42%, rgba(13, 12, 19, 1) 100%)`,
          inset: 0,
          position: 'absolute',
        }}
      />
      <div
        style={{
          background: `radial-gradient(circle at 18% 26%, ${toRgba(light, 0.09)} 0%, ${toRgba(light, 0.03)} 20%, ${toRgba(light, 0)} 48%), radial-gradient(circle at 78% 34%, ${toRgba(middle, 0.12)} 0%, ${toRgba(middle, 0.04)} 22%, ${toRgba(middle, 0)} 52%), radial-gradient(circle at 50% 72%, rgba(230, 241, 255, 0.05) 0%, rgba(230, 241, 255, 0.02) 24%, rgba(230, 241, 255, 0) 52%)`,
          inset: 0,
          position: 'absolute',
        }}
      />
      {dynamicBackground ? (
        <AuroraBackground
          amplitude={0.65}
          blend={0.62}
          colorStops={colorStops}
          enabled={dynamicBackground}
          speed={0.9}
          style={{ opacity: 0.62 }}
        />
      ) : null}
    </div>
  );
}

function useInterpolatedCoverPalette(target: CoverPalette): CoverPalette {
  const [palette, setPalette] = useState<CoverPalette>(target);
  const paletteRef = useRef(palette);

  useEffect(() => {
    const initial = paletteRef.current;
    if (initial.every((color, index) => color === target[index])) return;

    const startTime = performance.now();
    let frame = 0;
    const update = (time: number) => {
      const progress = Math.min(
        (time - startTime) / coverPaletteTransitionMs,
        1,
      );
      const next = interpolateCoverPalette(initial, target, progress);
      paletteRef.current = next;
      setPalette(next);
      if (progress < 1) frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return palette;
}

export function interpolateCoverPalette(
  from: CoverPalette,
  to: CoverPalette,
  progress: number,
): CoverPalette {
  return from.map((color, index) => {
    const source = parseHex(color);
    const destination = parseHex(to[index]!);
    return `#${source
      .map((channel, channelIndex) =>
        Math.round(channel + (destination[channelIndex]! - channel) * progress)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`;
  }) as CoverPalette;
}

function toRgba(color: string, alpha: number): string {
  const [red, green, blue] = parseHex(color);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function parseHex(color: string): [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}
