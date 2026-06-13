import { getLineTranslationForLanguage } from '../lyrics/lyrics';
import type { LyricsResult, OverlaySettings } from '../../shared/types';
import type { OverlayPhase } from './content-app';

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

const skeletonLineWidths = ['100%', '42%', '100%', '42%', '100%', '42%'];
const translationSkeletonWidths = ['36%', '32%', '34%', '30%'];
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

function renderStatusLabel(label: string, phase: OverlayPhase) {
  const isLoading = phase === 'loading-lyrics' || phase === 'loading-translation';

  if (!isLoading) {
    return (
      <p
        style={{
          color: 'rgba(255, 255, 255, 0.45)',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          margin: 0,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
    );
  }

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        gap: '12px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          color: '#1ed760',
          fontSize: '1.1rem',
          fontWeight: 900,
          letterSpacing: '0.22em',
          lineHeight: 1,
        }}
      >
        ...
      </span>
      <p
        style={{
          color: 'rgba(255, 255, 255, 0.62)',
          fontSize: '0.96rem',
          fontWeight: 500,
          letterSpacing: '0',
          margin: 0,
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
      <section
        className="lyra-replacement-lyrics"
        data-lyra-replacement-lyrics="true"
        data-lyra-replacement-scroll="true"
        style={{
          boxSizing: 'border-box',
          color: '#ffffff',
          height: 'calc(100vh - 96px)',
          overflowY: 'auto',
          padding: '64px 32px',
          scrollBehavior: 'smooth',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            margin: '0 auto',
            maxWidth: '980px',
          }}
        >
          {renderSkeletonAnimationStyle()}
          {renderStatusLabel(sourceLabel, phase)}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
            }}
          >
            {skeletonLineWidths.map((width, index) => (
              <div key={`skeleton-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  className="lyra-skeleton-line"
                  style={getSkeletonLineStyle('16px', width)}
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
        </div>
      </section>
    );
  }

  if (
    phase === 'unavailable' ||
    phase === 'error' ||
    lyrics.status === 'unavailable' ||
    lyrics.lines.length === 0
  ) {
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
          padding: '64px 32px',
          scrollBehavior: 'smooth',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
          }}
        >
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {sourceLabel}
          </p>
        </div>
      </section>
    );
  }

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
        padding: '64px 48px',
        scrollBehavior: 'smooth',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          margin: '0 auto',
          maxWidth: '980px',
        }}
      >
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
                    ...getSkeletonLineStyle(
                      '14px',
                      translationSkeletonWidths[
                        index % translationSkeletonWidths.length
                      ],
                    ),
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
      </div>
    </section>
  );
}
