import { getLineTranslationForLanguage } from '../lyrics/lyrics';
import type { LyricsResult, OverlaySettings } from '../../shared/types';
import type { OverlayPhase } from './lyrics-flow';
import type { CSSProperties, ReactNode } from 'react';

interface ReplacementLyricsProps {
  activeLineIndex: number;
  fontSize: OverlaySettings['fontSize'];
  phase: OverlayPhase;
  lyrics: LyricsResult;
  onLineSelect?: (index: number) => void;
  targetLanguage: string;
}

const lineFontSizes: Record<OverlaySettings['fontSize'], string> = {
  sm: '2rem',
  md: '2.75rem',
  lg: '3.35rem',
};

const translationFontSizes: Record<OverlaySettings['fontSize'], string> = {
  sm: '1rem',
  md: '1.2rem',
  lg: '1.45rem',
};

function getLyricsSourceLabel(lyrics: LyricsResult): string {
  if (lyrics.status === 'unavailable' || lyrics.lines.length === 0) {
    return 'No lyrics available';
  }

  return lyrics.source === 'spotify' ? 'Source: Native' : 'Source: LRCLIB';
}

function getStatusLabel(phase: OverlayPhase, lyrics: LyricsResult): string {
  if (phase === 'loading-lyrics') {
    return 'loading lyrics ...';
  }

  if (phase === 'loading-translation') {
    return 'loading translation ...';
  }

  return getLyricsSourceLabel(lyrics);
}

const loadingSkeletonGroupCount = 5;
const lyricsContentMaxWidth = '1024px';
const lyricsHorizontalPadding = 'clamp(20px, 4vw, 48px)';
const defaultLyricsPadding = `64px ${lyricsHorizontalPadding}`;
const loadingLyricsPadding = `24px ${lyricsHorizontalPadding} 64px`;
const skeletonOriginalWidth = '66.6667%';
const skeletonTranslationWidth = '33.3333%';
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

function getSkeletonLineStyle(height: string, width: string) {
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

function getSkeletonBeamStyle() {
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

function getStatusTextStyle(): CSSProperties {
  return {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    margin: 0,
    textTransform: 'uppercase',
  };
}

function renderStatusLabel(label: string, phase: OverlayPhase) {
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

function renderSkeletonAnimationStyle() {
  return <style>{skeletonAnimationStyles}</style>;
}

function ReplacementLyricsFrame({
  children,
  contentGap,
  padding,
  selectable = false,
}: {
  children: ReactNode;
  contentGap: string;
  padding: string;
  selectable?: boolean;
}) {
  return (
    <section
      className="lyra-replacement-lyrics"
      data-lyra-replacement-lyrics="true"
      data-lyra-replacement-scroll="true"
      style={{
        boxSizing: 'border-box',
        color: '#ffffff',
        height: 'calc(100vh - 96px)',
        overflowY: 'auto',
        padding,
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: contentGap,
          margin: '0 auto',
          maxWidth: lyricsContentMaxWidth,
          width: '100%',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function ReplacementLyrics({
  activeLineIndex,
  fontSize,
  phase,
  lyrics,
  onLineSelect,
  targetLanguage,
}: ReplacementLyricsProps) {
  const sourceLabel = getStatusLabel(phase, lyrics);

  if (phase === 'loading-lyrics') {
    return (
      <ReplacementLyricsFrame contentGap="16px" padding={loadingLyricsPadding}>
        {renderSkeletonAnimationStyle()}
        {renderStatusLabel(sourceLabel, phase)}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {Array.from({ length: loadingSkeletonGroupCount }, (_, index) => (
            <div
              key={`skeleton-group-${index}`}
              className="lyra-skeleton-group"
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div
                className="lyra-skeleton-line"
                style={getSkeletonLineStyle('16px', skeletonOriginalWidth)}
              >
                <span
                  aria-hidden="true"
                  className="lyra-skeleton-beam"
                  style={getSkeletonBeamStyle()}
                />
              </div>
              <div
                className="lyra-skeleton-line lyra-skeleton-line--translation"
                style={getSkeletonLineStyle('14px', skeletonTranslationWidth)}
              >
                <span
                  aria-hidden="true"
                  className="lyra-skeleton-beam"
                  style={getSkeletonBeamStyle()}
                />
              </div>
            </div>
          ))}
        </div>
      </ReplacementLyricsFrame>
    );
  }

  if (
    phase === 'unavailable' ||
    phase === 'error' ||
    lyrics.status === 'unavailable' ||
    lyrics.lines.length === 0
  ) {
    return (
      <ReplacementLyricsFrame contentGap="16px" padding={defaultLyricsPadding}>
        <p style={getStatusTextStyle()}>{sourceLabel}</p>
      </ReplacementLyricsFrame>
    );
  }

  return (
    <ReplacementLyricsFrame contentGap="32px" padding={defaultLyricsPadding} selectable>
      {phase === 'loading-translation' ? renderSkeletonAnimationStyle() : null}
      {renderStatusLabel(sourceLabel, phase)}
      {lyrics.lines.map((line, index) => {
        const translatedText = getLineTranslationForLanguage(line, targetLanguage);
        const isActive = index === activeLineIndex;

        return (
          <div
            key={`${line.timeMs}-${index}-${line.original}`}
            className="lyra-replacement-line"
            data-lyra-replacement-active={isActive ? 'true' : undefined}
            role="button"
            tabIndex={0}
            style={{
              color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
              cursor: 'pointer',
              transition: 'color 200ms ease, opacity 200ms ease',
            }}
            onClick={() => onLineSelect?.(index)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') {
                return;
              }

              event.preventDefault();
              onLineSelect?.(index);
            }}
          >
            <p
              className="lyra-replacement-original"
              style={{
                fontSize: lineFontSizes[fontSize],
                fontWeight: 900,
                letterSpacing: '0',
                lineHeight: 1.08,
                margin: 0,
              }}
            >
              {line.original}
            </p>
            {translatedText ? (
              <p
                className="lyra-replacement-translation"
                style={{
                  color: 'rgba(255, 255, 255, 0.65)',
                  fontSize: translationFontSizes[fontSize],
                  fontWeight: 600,
                  lineHeight: 1.35,
                  margin: '12px 0 0',
                }}
              >
                {translatedText}
              </p>
            ) : phase === 'loading-translation' ? (
              <div
                className="lyra-skeleton-line lyra-skeleton-line--translation"
                style={{
                  ...getSkeletonLineStyle('14px', skeletonTranslationWidth),
                  marginTop: '12px',
                }}
              >
                <span
                  aria-hidden="true"
                  className="lyra-skeleton-beam"
                  style={getSkeletonBeamStyle()}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </ReplacementLyricsFrame>
  );
}
