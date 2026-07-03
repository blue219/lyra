import type { CSSProperties, ReactNode } from 'react';

import { AuroraBackground } from './aurora-background';
import type { OverlayPhase } from './lyrics-flow';

export const loadingSkeletonGroupCount = 5;
export const lyricsContentMaxWidth = '1024px';
export const lyricsHorizontalPadding = 'clamp(20px, 4vw, 48px)';
export const defaultLyricsPadding = `64px ${lyricsHorizontalPadding}`;
export const loadingLyricsPadding = `24px ${lyricsHorizontalPadding} 64px`;
export const skeletonOriginalWidth = '66.6667%';
export const skeletonTranslationWidth = '33.3333%';

const replacementViewportHeight = 'calc(100vh - 96px)';
const replacementViewportNegativeMargin = 'calc(-1 * (100vh - 96px))';
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

export function StatusLabel({
  label,
  phase,
}: {
  label: string;
  phase: OverlayPhase;
}) {
  const isLoading = phase === 'loading-lyrics' || phase === 'loading-translation';

  if (!isLoading) {
    return (
      <p
        style={getStatusTextStyle()}
      >
        {label}
      </p>
    );
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
              width: index === 2 ? '10px' : index === 1 || index === 3 ? '8px' : '6px',
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
  dynamicBackground,
  padding,
  selectable = false,
}: {
  children: ReactNode;
  contentGap: string;
  dynamicBackground: boolean;
  padding: string;
  selectable?: boolean;
}) {
  return (
    <section
      className="lyra-replacement-lyrics"
      data-lyra-replacement-lyrics="true"
      data-lyra-replacement-scroll="true"
      style={{
        backgroundColor: '#121212',
        boxSizing: 'border-box',
        color: '#ffffff',
        height: replacementViewportHeight,
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
      <AuroraLayer dynamicBackground={dynamicBackground} />
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

function AuroraLayer({ dynamicBackground }: { dynamicBackground: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-lyra-aurora="true"
      style={{
        height: replacementViewportHeight,
        marginBottom: replacementViewportNegativeMargin,
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
          background:
            'radial-gradient(circle at 18% 12%, rgba(106, 255, 173, 0.2) 0%, rgba(106, 255, 173, 0.06) 18%, rgba(106, 255, 173, 0) 42%), radial-gradient(circle at 76% 10%, rgba(96, 58, 255, 0.24) 0%, rgba(96, 58, 255, 0.08) 24%, rgba(96, 58, 255, 0) 52%), linear-gradient(180deg, rgba(17, 12, 24, 0.94) 0%, rgba(14, 16, 22, 0.97) 42%, rgba(13, 12, 19, 1) 100%)',
          inset: 0,
          position: 'absolute',
        }}
      />
      <div
        style={{
          background:
            'radial-gradient(circle at 18% 26%, rgba(106, 255, 173, 0.09) 0%, rgba(106, 255, 173, 0.03) 20%, rgba(106, 255, 173, 0) 48%), radial-gradient(circle at 78% 34%, rgba(96, 58, 255, 0.12) 0%, rgba(96, 58, 255, 0.04) 22%, rgba(96, 58, 255, 0) 52%), radial-gradient(circle at 50% 72%, rgba(230, 241, 255, 0.05) 0%, rgba(230, 241, 255, 0.02) 24%, rgba(230, 241, 255, 0) 52%)',
          inset: 0,
          position: 'absolute',
        }}
      />
      {dynamicBackground ? (
        <AuroraBackground
          amplitude={0.65}
          blend={0.62}
          colorStops={['#7cff67', '#b497cf', '#5227ff']}
          enabled={dynamicBackground}
          speed={0.9}
          style={{ opacity: 0.62 }}
        />
      ) : null}
    </div>
  );
}
