import type { LyricLine, LyricsResult } from '../../shared/types';

const defaultTranslateApiBaseUrl = 'http://154.44.10.127:5000';
const lineSeparator = '\n';

export async function translateLyricsResult(
  result: LyricsResult,
  targetLanguage: string | undefined,
): Promise<LyricsResult> {
  if (result.status === 'unavailable' || result.lines.length === 0 || !targetLanguage) {
    return result;
  }

  const translationResult = await translateLyricLinesWithDetection(
    result.lines,
    targetLanguage,
  );
  const translatedLines = translationResult.lines;
  const hasAnyTranslation = translatedLines.some((line) => Boolean(line.translated));

  return {
    ...result,
    sourceLanguage: translationResult.sourceLanguage,
    status: hasAnyTranslation ? 'bilingual' : 'monolingual',
    lines: translatedLines,
  };
}

/** Translates lyric lines in one LibreTranslate request. Failures intentionally
 *  return the original lines so the overlay stays readable without translation.
 */
export async function translateLyricLines(
  lines: LyricLine[],
  targetLanguage: string,
): Promise<LyricLine[]> {
  return (await translateLyricLinesWithDetection(lines, targetLanguage)).lines;
}

async function translateLyricLinesWithDetection(
  lines: LyricLine[],
  targetLanguage: string,
): Promise<{ lines: LyricLine[]; sourceLanguage?: string }> {
  if (lines.length === 0) {
    return { lines };
  }

  const targetCode = toLibreTranslateLanguage(targetLanguage);

  if (!targetCode) {
    return { lines };
  }

  const apiKey = getLibreTranslateApiKey();

  if (!apiKey) {
    console.warn('[Lyra] LibreTranslate API key is missing');
    return { lines };
  }

  const sourceLanguage = await detectLyricsSourceLanguage(lines, apiKey);
  const sourceCode = toLibreTranslateLanguage(sourceLanguage);

  if (!sourceLanguage || !sourceCode || sourceCode === targetCode) {
    return {
      lines,
      sourceLanguage,
    };
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
      return { lines, sourceLanguage };
    }

    return {
      lines: lines.map((line, index) => ({
        ...line,
        translated:
          normalizeTranslatedLyricText(line, translatedLines[index] ?? '') || undefined,
        translatedLanguage: targetLanguage,
      })),
      sourceLanguage,
    };
  } catch (error) {
    console.warn('[Lyra] Translation failed, showing original lyrics:', error);
    return { lines, sourceLanguage };
  }
}

function normalizeTranslatedLyricText(line: LyricLine, text: string): string {
  if (isMusicalMarkerLine(line.original)) {
    return line.original.trim();
  }

  return text.replace(/\{\\[^{}]*\}/g, '').trim();
}

function isMusicalMarkerLine(text: string): boolean {
  return /^[\s♪♫♬♩]+$/u.test(text);
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

async function detectLyricsSourceLanguage(
  lines: LyricLine[],
  apiKey: string,
): Promise<string | undefined> {
  try {
    const response = await fetch(`${getLibreTranslateBaseUrl()}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: lines.map((line) => line.original).join(lineSeparator),
        api_key: apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate detect request failed: ${response.status}`);
    }

    const data: unknown = await response.json();

    const detectedLanguage = Array.isArray(data)
      ? (data[0] as { language?: unknown } | undefined)?.language
      : (data as { language?: unknown } | null)?.language;

    if (typeof detectedLanguage !== 'string') {
      throw new Error('Unexpected LibreTranslate detect response format');
    }

    return fromLibreTranslateLanguage(detectedLanguage);
  } catch (error) {
    console.warn('[Lyra] Language detection failed, showing original lyrics:', error);
    return undefined;
  }
}

function fromLibreTranslateLanguage(language: string): string | undefined {
  if (language === 'en') {
    return 'en-US';
  }

  if (language === 'zh-Hans') {
    return 'zh-CN';
  }

  return undefined;
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
