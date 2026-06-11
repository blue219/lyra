import type { LyricLine } from './types';

const TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';
const lineSeparator = '␞';

/** Translates the original line text for every line in one API call by joining
 *  with a separator that Google Translate preserves more reliably than newlines.
 *  Falls back silently when translation fails so the overlay stays usable with
 *  original lyrics only. */
export async function translateLyricLines(
  lines: LyricLine[],
  sourceLanguage: string | undefined,
  targetLanguage: string,
): Promise<LyricLine[]> {
  if (lines.length === 0) return lines;

  const sourceCode = sourceLanguage?.split('-')[0] ?? 'auto';
  const targetCode = targetLanguage.split('-')[0];

  // If source and target share the same root language tag there is nothing to
  // translate (e.g. zh-CN → zh-TW is not handled by the free endpoint).
  if (sourceCode === targetCode) return lines;

  try {
    const originalText = lines.map((line) => line.original).join(lineSeparator);

    const params = new URLSearchParams({
      client: 'gtx',
      sl: sourceCode,
      tl: targetCode,
      dt: 't',
      q: originalText,
    });

    const response = await fetch(`${TRANSLATE_API}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Translation API returned ${response.status}`);
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error('Unexpected translation response format');
    }

    const translatedText = (data[0] as Array<Array<unknown>>)
      .map((segment) => (typeof segment[0] === 'string' ? segment[0] : ''))
      .join('');

    const translatedLines = translatedText.split(lineSeparator);

    if (translatedLines.length !== lines.length) {
      console.warn(
        `[Lyra] Translation line count mismatch (got ${translatedLines.length}, expected ${lines.length})`,
      );
      return lines;
    }

    return lines.map((line, index) => ({
      ...line,
      translated: translatedLines[index]?.trim() || undefined,
      translatedLanguage: targetLanguage,
    }));
  } catch (error) {
    console.warn('[Lyra] Translation failed, showing original lyrics:', error);
    return lines;
  }
}
