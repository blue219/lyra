import { getLineTranslationForLanguage } from '../lyrics/lyrics';
import { readVisibleSpotifyLyricEntries } from '../spotify/spotify-dom';
import type { LyricsResult, OverlaySettings } from '../../shared/types';

interface InlineLyricsOptions {
  activeLineIndex?: number;
  fontSize: OverlaySettings['fontSize'];
  targetLanguage: string;
}

const inlineTranslationSelector = '[data-lyra-inline-translation="true"]';
const fontSizeClassNames: Record<OverlaySettings['fontSize'], string> = {
  sm: 'lyra-inline-translation--sm',
  md: 'lyra-inline-translation--md',
  lg: 'lyra-inline-translation--lg',
};
const fontSizeValues: Record<OverlaySettings['fontSize'], string> = {
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
};
export function renderInlineLyrics(
  rootDocument: Document,
  lyrics: LyricsResult,
  options: InlineLyricsOptions,
) {
  const lyricEntries = readVisibleSpotifyLyricEntries(rootDocument);
  const activeElements = new Set<Element>();

  lyricEntries.forEach(({ element: lyricElement }, index) => {
    const lyricLine = lyrics.lines[index];
    const translatedText = lyricLine
      ? getLineTranslationForLanguage(lyricLine, options.targetLanguage)
      : undefined;

    applyActiveLineStyles(lyricElement, index === options.activeLineIndex);
    const existingTranslation = getInlineTranslation(lyricElement);

    if (!translatedText) {
      existingTranslation?.remove();
      return;
    }

    const translationElement =
      existingTranslation ?? rootDocument.createElement('div');

    translationElement.setAttribute('data-lyra-inline-translation', 'true');
    translationElement.className = [
      'lyra-inline-translation',
      fontSizeClassNames[options.fontSize],
    ].join(' ');
    applyInlineTranslationStyles(translationElement, options.fontSize);
    translationElement.textContent = translatedText;
    activeElements.add(translationElement);

    if (!existingTranslation) {
      lyricElement.append(translationElement);
    }
  });

  rootDocument
    .querySelectorAll<HTMLElement>(inlineTranslationSelector)
    .forEach((translationElement) => {
      if (!activeElements.has(translationElement)) {
        translationElement.remove();
      }
    });
}

export function clearInlineLyrics(rootDocument: Document = document) {
  rootDocument
    .querySelectorAll(inlineTranslationSelector)
    .forEach((translationElement) => {
      translationElement.remove();
    });
  rootDocument
    .querySelectorAll<HTMLElement>('[data-lyra-active-line="true"]')
    .forEach((lyricElement) => {
      applyActiveLineStyles(lyricElement, false);
    });
}

function applyActiveLineStyles(lyricElement: HTMLElement, isActive: boolean) {
  if (!isActive) {
    lyricElement.removeAttribute('data-lyra-active-line');
    lyricElement.style.borderLeft = '';
    lyricElement.style.boxShadow = '';
    lyricElement.style.paddingLeft = '';
    return;
  }

  lyricElement.setAttribute('data-lyra-active-line', 'true');
  lyricElement.style.borderLeft = '';
  lyricElement.style.boxShadow = 'inset 3px 0 0 #1ed760';
  lyricElement.style.paddingLeft = '';
}

function applyInlineTranslationStyles(
  translationElement: HTMLElement,
  fontSize: OverlaySettings['fontSize'],
) {
  translationElement.style.color = '#b3b3b3';
  translationElement.style.fontFamily = 'inherit';
  translationElement.style.fontSize = fontSizeValues[fontSize];
  translationElement.style.fontWeight = 'inherit';
  translationElement.style.lineHeight = '1.35';
  translationElement.style.marginTop = '6px';
  translationElement.style.opacity = '0.82';
  translationElement.style.pointerEvents = 'none';
}

function getInlineTranslation(lyricElement: HTMLElement): HTMLElement | null {
  return lyricElement.querySelector<HTMLElement>(inlineTranslationSelector);
}
