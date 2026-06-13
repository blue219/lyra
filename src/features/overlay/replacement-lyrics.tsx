import { getLineTranslationForLanguage } from '../lyrics/lyrics';
import type { LyricsResult, OverlaySettings } from '../../shared/types';

interface ReplacementLyricsProps {
  activeLineIndex: number;
  fontSize: OverlaySettings['fontSize'];
  lyrics: LyricsResult;
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

export function ReplacementLyrics({
  activeLineIndex,
  fontSize,
  lyrics,
  targetLanguage,
}: ReplacementLyricsProps) {
  if (lyrics.status === 'unavailable' || lyrics.lines.length === 0) {
    return (
      <section
        className="lyra-replacement-lyrics"
        data-lyra-replacement-lyrics="true"
        data-lyra-replacement-scroll="true"
        style={{
          alignItems: 'center',
          boxSizing: 'border-box',
          color: '#ffffff',
          display: 'flex',
          height: 'calc(100vh - 96px)',
          minHeight: '55vh',
          overflowY: 'auto',
          padding: '64px 32px',
          scrollBehavior: 'smooth',
        }}
      >
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '1.5rem',
            fontWeight: 900,
            margin: 0,
          }}
        >
          No synced lyrics available
        </p>
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
        {lyrics.lines.map((line, index) => {
          const translatedText = getLineTranslationForLanguage(line, targetLanguage);
          const isActive = index === activeLineIndex;

          return (
            <div
              key={`${line.timeMs}-${index}-${line.original}`}
              className="lyra-replacement-line"
              data-lyra-replacement-active={isActive ? 'true' : undefined}
              style={{
                color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                transition: 'color 200ms ease, opacity 200ms ease',
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
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
