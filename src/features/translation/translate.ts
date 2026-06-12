import type { LyricLine, LyricsResult } from '../../shared/types';

const defaultTranslateApiBaseUrl = 'http://154.44.10.127:5000';
const lineSeparator = '␞';

export async function translateLyricsResult(
  result: LyricsResult,
  targetLanguage: string | undefined,
): Promise<LyricsResult> {
  if (result.status === 'unavailable' || result.lines.length === 0 || !targetLanguage) {
    return result;
  }

  const translatedLines = await translateLyricLines(
    result.lines,
    result.sourceLanguage,
    targetLanguage,
  );
  const hasAnyTranslation = translatedLines.some((line) => Boolean(line.translated));

  return {
    ...result,
    status: hasAnyTranslation ? 'bilingual' : 'monolingual',
    lines: translatedLines,
  };
}

/** Translates lyric lines in one LibreTranslate request. Failures intentionally
 *  return the original lines so the overlay stays readable without translation.
 */
export async function translateLyricLines(
  lines: LyricLine[],
  sourceLanguage: string | undefined,
  targetLanguage: string,
): Promise<LyricLine[]> {
  if (lines.length === 0) {
    return lines;
  }

  const targetCode = toLibreTranslateLanguage(targetLanguage);
  const sourceCode = toLibreTranslateLanguage(sourceLanguage);

  if (!targetCode || !sourceCode || sourceCode === targetCode) {
    return lines;
  }

  const apiKey = getLibreTranslateApiKey();

  if (!apiKey) {
    console.warn('[Lyra] LibreTranslate API key is missing');
    return lines;
  }

  try {
    const response = await fetch(`${getLibreTranslateBaseUrl()}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: lines.map((line) => line.original).join(lineSeparator),
        source: sourceCode,
        target: targetCode,
        format: 'text',
        api_key: apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate request failed: ${response.status}`);
    }

    const data: unknown = await response.json();

    if (
      !data ||
      typeof data !== 'object' ||
      typeof (data as { translatedText?: unknown }).translatedText !== 'string'
    ) {
      throw new Error('Unexpected LibreTranslate response format');
    }

    const translatedLines = (data as { translatedText: string }).translatedText.split(
      lineSeparator,
    );

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

function toLibreTranslateLanguage(language: string | undefined): string | null {
  if (!language) {
    return null;
  }

  if (language === 'en-US' || language === 'en') {
    return 'en';
  }

  if (language === 'zh-CN' || language === 'zh-Hans') {
    return 'zh-Hans';
  }

  return null;
}

function getLibreTranslateBaseUrl(): string {
  return (
    (import.meta.env.VITE_LIBRETRANSLATE_BASE_URL as string | undefined)?.replace(
      /\/+$/,
      '',
    ) || defaultTranslateApiBaseUrl
  );
}

function getLibreTranslateApiKey(): string | undefined {
  const value = import.meta.env.VITE_LIBRETRANSLATE_API_KEY as string | undefined;
  return value?.trim() || undefined;
}
