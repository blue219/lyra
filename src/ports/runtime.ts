import type {
  CacheSummary,
  LyricLine,
  LyricsResult,
  LyricsSource,
  TrackIdentity,
} from '@/src/domain/model';
import type { CoverPalette } from '@/src/domain/cover-palette';

export interface FetchLyricsRequest {
  type: 'lyra:fetchLyrics';
  track: TrackIdentity;
  targetLanguage?: string;
}

export interface TranslateLyricsRequest {
  type: 'lyra:translateLyrics';
  lines: LyricLine[];
  targetLanguage?: string;
  source: LyricsSource;
}

export interface GetLyricsCacheSummaryRequest {
  type: 'lyra:getLyricsCacheSummary';
}

export interface ClearLyricsCacheRequest {
  type: 'lyra:clearLyricsCache';
}

export interface ResolveCoverPaletteRequest {
  type: 'lyra:resolveCoverPalette';
  coverImageUrl: string;
}

export interface RuntimeRequestMap {
  'lyra:fetchLyrics': {
    request: FetchLyricsRequest;
    response: LyricsResult;
  };
  'lyra:translateLyrics': {
    request: TranslateLyricsRequest;
    response: LyricsResult;
  };
  'lyra:getLyricsCacheSummary': {
    request: GetLyricsCacheSummaryRequest;
    response: CacheSummary;
  };
  'lyra:clearLyricsCache': {
    request: ClearLyricsCacheRequest;
    response: { ok: true };
  };
  'lyra:resolveCoverPalette': {
    request: ResolveCoverPaletteRequest;
    response: CoverPalette | null;
  };
}

export type RuntimeRequestType = keyof RuntimeRequestMap;
export type RuntimeRequest = RuntimeRequestMap[RuntimeRequestType]['request'];

export interface RuntimeMessenger {
  sendMessage(message: unknown): Promise<unknown>;
}

export type RuntimeHandlers = {
  [Type in RuntimeRequestType]: (
    request: RuntimeRequestMap[Type]['request'],
  ) => Promise<RuntimeRequestMap[Type]['response']>;
};

export function createRuntimeClient(runtime: RuntimeMessenger) {
  return {
    async send<Type extends RuntimeRequestType>(
      request: RuntimeRequestMap[Type]['request'],
    ): Promise<RuntimeRequestMap[Type]['response']> {
      const response = await runtime.sendMessage(request);

      if (isRuntimeErrorResponse(response)) {
        throw new Error(response.__lyraRuntimeError);
      }

      if (!isRuntimeResponse(request.type, response)) {
        throw new Error(`Invalid runtime response for ${request.type}`);
      }

      return response as RuntimeRequestMap[Type]['response'];
    },
  };
}

export function createRuntimeHandlerRegistry(handlers: RuntimeHandlers) {
  return (
    value: unknown,
    _sender?: unknown,
    sendResponse?: (response: unknown) => void,
  ): Promise<unknown> | boolean | undefined => {
    if (!isRuntimeRequest(value)) {
      return undefined;
    }

    let response: Promise<unknown>;
    switch (value.type) {
      case 'lyra:fetchLyrics':
        response = handlers['lyra:fetchLyrics'](value);
        break;
      case 'lyra:translateLyrics':
        response = handlers['lyra:translateLyrics'](value);
        break;
      case 'lyra:getLyricsCacheSummary':
        response = handlers['lyra:getLyricsCacheSummary'](value);
        break;
      case 'lyra:clearLyricsCache':
        response = handlers['lyra:clearLyricsCache'](value);
        break;
      case 'lyra:resolveCoverPalette':
        response = handlers['lyra:resolveCoverPalette'](value);
        break;
    }

    if (!sendResponse) {
      return response;
    }

    // Chrome MV3 keeps the channel open only when callback-style listeners return true.
    void response.then(sendResponse, (error: unknown) =>
      sendResponse({
        __lyraRuntimeError:
          error instanceof Error ? error.message : 'Runtime request failed',
      }),
    );
    return true;
  };
}

export function isRuntimeRequest(value: unknown): value is RuntimeRequest {
  if (!isPlainRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'lyra:fetchLyrics':
      return (
        hasOnlyKeys(value, ['type', 'track', 'targetLanguage']) &&
        isTrackIdentity(value.track) &&
        isOptionalNonEmptyString(value.targetLanguage)
      );
    case 'lyra:translateLyrics':
      return (
        hasOnlyKeys(value, ['type', 'lines', 'targetLanguage', 'source']) &&
        Array.isArray(value.lines) &&
        value.lines.every(isLyricLine) &&
        isOptionalNonEmptyString(value.targetLanguage) &&
        (value.source === 'spotify' || value.source === 'lrclib')
      );
    case 'lyra:getLyricsCacheSummary':
    case 'lyra:clearLyricsCache':
      return hasOnlyKeys(value, ['type']);
    case 'lyra:resolveCoverPalette':
      return (
        hasOnlyKeys(value, ['type', 'coverImageUrl']) &&
        isNonEmptyString(value.coverImageUrl)
      );
    default:
      return false;
  }
}

function isRuntimeResponse(type: RuntimeRequestType, value: unknown): boolean {
  switch (type) {
    case 'lyra:fetchLyrics':
    case 'lyra:translateLyrics':
      return isLyricsResult(value);
    case 'lyra:getLyricsCacheSummary':
      return (
        isPlainRecord(value) &&
        hasOnlyKeys(value, [
          'songCount',
          'entryCount',
          'maxEntries',
          'sizeBytes',
        ]) &&
        ['songCount', 'entryCount', 'maxEntries', 'sizeBytes'].every(
          (key) =>
            typeof value[key] === 'number' && Number.isFinite(value[key]),
        )
      );
    case 'lyra:clearLyricsCache':
      return (
        isPlainRecord(value) && hasOnlyKeys(value, ['ok']) && value.ok === true
      );
    case 'lyra:resolveCoverPalette':
      return value === null || isCoverPalette(value);
  }
}

function isTrackIdentity(value: unknown): value is TrackIdentity {
  return (
    isPlainRecord(value) &&
    hasOnlyKeys(value, ['title', 'artists', 'album', 'durationSeconds']) &&
    isNonEmptyString(value.title) &&
    Array.isArray(value.artists) &&
    value.artists.length > 0 &&
    value.artists.every(isNonEmptyString) &&
    (value.album === undefined || isNonEmptyString(value.album)) &&
    (value.durationSeconds === undefined ||
      (typeof value.durationSeconds === 'number' &&
        Number.isFinite(value.durationSeconds) &&
        value.durationSeconds >= 0))
  );
}

function isLyricLine(value: unknown): value is LyricLine {
  return (
    isPlainRecord(value) &&
    hasOnlyKeys(value, [
      'timeMs',
      'original',
      'translated',
      'translatedLanguage',
    ]) &&
    typeof value.timeMs === 'number' &&
    Number.isFinite(value.timeMs) &&
    value.timeMs >= 0 &&
    typeof value.original === 'string' &&
    (value.translated === undefined || typeof value.translated === 'string') &&
    (value.translatedLanguage === undefined ||
      isNonEmptyString(value.translatedLanguage))
  );
}

function isCoverPalette(value: unknown): value is CoverPalette {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (color) => typeof color === 'string' && /^#[0-9a-f]{6}$/iu.test(color),
    )
  );
}

function isLyricsResult(value: unknown): value is LyricsResult {
  if (!isPlainRecord(value) || !Array.isArray(value.lines)) {
    return false;
  }

  if (value.status === 'available') {
    return (
      hasOnlyKeys(value, [
        'status',
        'source',
        'lines',
        'sourceLanguage',
        'degradationReason',
      ]) &&
      (value.source === 'spotify' || value.source === 'lrclib') &&
      value.lines.length > 0 &&
      value.lines.every(isLyricLine) &&
      isOptionalNonEmptyString(value.sourceLanguage) &&
      (value.degradationReason === undefined ||
        [
          'same-language',
          'same-text',
          'provider-error',
          'rate-limited',
          'network-error',
          'invalid-response',
          'timeout',
        ].includes(String(value.degradationReason)))
    );
  }

  return (
    value.status === 'unavailable' &&
    hasOnlyKeys(value, ['status', 'reason', 'lines']) &&
    value.lines.length === 0 &&
    [
      'not-found',
      'instrumental',
      'provider-error',
      'rate-limited',
      'network-error',
      'invalid-response',
      'timeout',
      'extension-context-invalidated',
    ].includes(String(value.reason))
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRuntimeErrorResponse(
  value: unknown,
): value is { __lyraRuntimeError: string } {
  return (
    isPlainRecord(value) &&
    hasOnlyKeys(value, ['__lyraRuntimeError']) &&
    isNonEmptyString(value.__lyraRuntimeError)
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalNonEmptyString(value: unknown): boolean {
  return value === undefined || isNonEmptyString(value);
}
