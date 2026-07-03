import { getLineTranslationForLanguage } from '../lyrics/lyrics';
import type { LyricsResult, OverlaySettings } from '../../shared/types';
import type { OverlayPhase } from './lyrics-flow';
import {
  defaultLyricsPadding,
  getSkeletonBeamStyle,
  getSkeletonLineStyle,
  getStatusTextStyle,
  loadingLyricsPadding,
  loadingSkeletonGroupCount,
  ReplacementLyricsFrame,
  skeletonOriginalWidth,
  skeletonTranslationWidth,
  StatusLabel,
} from './replacement-lyrics-frame';

interface ReplacementLyricsProps {
  activeLineIndex: number;
  dynamicBackground: boolean;
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
const activeAccentColor = '#1ed760';

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

export function ReplacementLyrics({
  activeLineIndex,
  dynamicBackground,
  fontSize,
  phase,
  lyrics,
  onLineSelect,
  targetLanguage,
}: ReplacementLyricsProps) {
  const sourceLabel = getStatusLabel(phase, lyrics);

  if (phase === 'loading-lyrics') {
    return (
      <ReplacementLyricsFrame
        contentGap="16px"
        dynamicBackground={dynamicBackground}
        padding={loadingLyricsPadding}
      >
        <StatusLabel label={sourceLabel} phase={phase} />
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
      <ReplacementLyricsFrame
        contentGap="16px"
        dynamicBackground={dynamicBackground}
        padding={defaultLyricsPadding}
      >
        <p style={getStatusTextStyle()}>{sourceLabel}</p>
      </ReplacementLyricsFrame>
    );
  }

  return (
    <ReplacementLyricsFrame
      contentGap="32px"
      dynamicBackground={dynamicBackground}
      padding={defaultLyricsPadding}
      selectable
    >
      <StatusLabel label={sourceLabel} phase={phase} />
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
              borderLeft: isActive ? `3px solid ${activeAccentColor}` : '3px solid transparent',
              color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
              cursor: 'pointer',
              paddingLeft: '14px',
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
                  color: isActive ? activeAccentColor : 'rgba(255, 255, 255, 0.65)',
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
