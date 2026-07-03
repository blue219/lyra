import type { LyricLine } from '../../shared/types';
import {
  applyTranslatedLines,
  googleLineJoiner,
  googleLineSeparator,
} from './line-chunks';
import {
  fromMicrosoftTranslateLanguage,
  toMicrosoftTranslateLanguage,
} from './language-codes';
import {
  classifyTranslationFailure,
  HttpStatusError,
  InvalidTranslationResponseError,
  type TranslationAttemptResult,
  type TranslationProvider,
} from './translation-types';

interface BingWebSession {
  endpointUrl: URL;
  token: string;
  key: string;
}

export interface BingWebProviderConfig {
  name: 'Microsoft Translator web' | 'Bing Translator web';
  pageUrl: string;
}

export function createBingWebProvider(config: BingWebProviderConfig): TranslationProvider {
  let sessionPromise: Promise<BingWebSession> | undefined;

  return async (lines, targetLanguage) => {
    const targetCode = toMicrosoftTranslateLanguage(targetLanguage);

    if (!targetCode) {
      return { status: 'failed' };
    }

    try {
      sessionPromise ??= fetchBingWebSession(config.pageUrl);
      const session = await sessionPromise;
      const response = await fetch(session.endpointUrl.toString(), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Referer: config.pageUrl,
        },
        body: createBingWebRequestBody(lines, targetCode, session),
      });

      if (!response.ok) {
        throw new HttpStatusError(
          `${config.name} request failed: ${response.status}`,
          response.status,
        );
      }

      const data: unknown = await response.json();
      const sourceLanguage = readMicrosoftSourceLanguage(data);
      const sourceCode = toMicrosoftTranslateLanguage(sourceLanguage);

      if (!sourceLanguage || !sourceCode) {
        throw new InvalidTranslationResponseError(
          `Unexpected ${config.name} source language`,
        );
      }

      const translatedText = readMicrosoftTranslatedText(data);
      const translatedLines = translatedText.split(googleLineSeparator);

      if (translatedLines.length !== lines.length) {
        throw new InvalidTranslationResponseError(
          `${config.name} line count mismatch (got ${translatedLines.length}, expected ${lines.length})`,
        );
      }

      const nextLines = applyTranslatedLines(lines, translatedLines, targetLanguage);
      const hasAnyTranslation = nextLines.some((line) => Boolean(line.translated));

      if (!hasAnyTranslation) {
        return {
          status: sourceCode === targetCode ? 'same-language' : 'same-text',
          lines,
          sourceLanguage,
        };
      }

      return {
        status: 'translated',
        lines: nextLines,
        sourceLanguage,
      };
    } catch (error) {
      console.warn(
        `[Lyra] ${config.name} chunk failed, trying the next translation provider:`,
        error,
      );
      return classifyTranslationFailure(error);
    }
  };
}

async function fetchBingWebSession(pageUrl: string): Promise<BingWebSession> {
  const response = await fetch(pageUrl, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new HttpStatusError(
      `Translator page request failed: ${response.status}`,
      response.status,
    );
  }

  return readBingWebSession(await response.text(), pageUrl);
}

function readBingWebSession(html: string, pageUrl: string): BingWebSession {
  const ig =
    readFirstRegexCapture(html, /\bIG:"([^"]+)"/) ??
    readFirstRegexCapture(html, /"IG":"([^"]+)"/);
  const authMatch = html.match(
    /params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)",\d+\]/,
  );

  if (!ig || !authMatch) {
    throw new InvalidTranslationResponseError('Translator page session missing');
  }

  const endpointPath =
    readFirstRegexCapture(html, /params_RichTranslate\s*=\s*\[\s*"([^"]+)"/) ??
    '/ttranslatev3?isVertical=1&';
  const endpointUrl = new URL(decodeBingJavascriptString(endpointPath), pageUrl);

  endpointUrl.searchParams.set('IG', ig);
  endpointUrl.searchParams.set('IID', 'translator.5028');

  return {
    endpointUrl,
    key: authMatch[1] ?? '',
    token: authMatch[2] ?? '',
  };
}

function decodeBingJavascriptString(value: string): string {
  return value.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
}

function createBingWebRequestBody(
  lines: LyricLine[],
  targetCode: string,
  session: BingWebSession,
): URLSearchParams {
  const body = new URLSearchParams();

  body.set('fromLang', 'auto-detect');
  body.set('text', lines.map((line) => line.original).join(googleLineJoiner));
  body.set('to', targetCode);
  body.set('token', session.token);
  body.set('key', session.key);

  return body;
}

function readMicrosoftTranslatedText(data: unknown): string {
  const firstResult = readFirstMicrosoftResult(data);
  const translations = firstResult.translations;

  if (!Array.isArray(translations)) {
    throw new InvalidTranslationResponseError(
      'Unexpected Microsoft Translator translations format',
    );
  }

  const firstTranslation = translations[0];

  if (
    !firstTranslation ||
    typeof firstTranslation !== 'object' ||
    typeof (firstTranslation as { text?: unknown }).text !== 'string'
  ) {
    throw new InvalidTranslationResponseError(
      'Unexpected Microsoft Translator translation format',
    );
  }

  return (firstTranslation as { text: string }).text;
}

function readMicrosoftSourceLanguage(data: unknown): string | undefined {
  const firstResult = readFirstMicrosoftResult(data);
  const detectedLanguage = firstResult.detectedLanguage;

  if (!detectedLanguage || typeof detectedLanguage !== 'object') {
    return undefined;
  }

  const language = (detectedLanguage as { language?: unknown }).language;

  return typeof language === 'string'
    ? fromMicrosoftTranslateLanguage(language)
    : undefined;
}

function readFirstMicrosoftResult(data: unknown): Record<string, unknown> {
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') {
    throw new InvalidTranslationResponseError(
      'Unexpected Microsoft Translator response format',
    );
  }

  return data[0] as Record<string, unknown>;
}

function readFirstRegexCapture(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1];
}
