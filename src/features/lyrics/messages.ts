import { getExtensionApi, isExtensionContextInvalidatedError } from '../../shared/extension-api';
import { fetchLyricsFromLrclib } from './lrclib';
import { translateLyricsResult } from '../translation/translate';
import type {
  CacheSummary,
  LyricLine,
  LyricsResult,
  TrackIdentity,
} from '../../shared/types';

export interface FetchLyricsMessage {
  type: 'lyra:fetchLyrics';
  track: TrackIdentity;
  targetLanguage?: string;
}

export interface FetchOriginalLyricsMessage {
  type: 'lyra:fetchOriginalLyrics';
  track: TrackIdentity;
}

export interface TranslateLyricsMessage {
  type: 'lyra:translateLyrics';
  lines: LyricLine[];
  targetLanguage?: string;
  source?: LyricsResult['source'];
}

export interface GetLyricsCacheSummaryMessage {
  type: 'lyra:getLyricsCacheSummary';
}

export interface ClearLyricsCacheMessage {
  type: 'lyra:clearLyricsCache';
}

const unavailableLyricsResult: LyricsResult = {
  status: 'unavailable',
  unavailableReason: 'extension-context-invalidated',
  lines: [],
};

type ExtensionApi = ReturnType<typeof getExtensionApi>;

export function isFetchLyricsMessage(value: unknown): value is FetchLyricsMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<FetchLyricsMessage>;

  return message.type === 'lyra:fetchLyrics' && Boolean(message.track);
}

export function isFetchOriginalLyricsMessage(
  value: unknown,
): value is FetchOriginalLyricsMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<FetchOriginalLyricsMessage>;

  return message.type === 'lyra:fetchOriginalLyrics' && Boolean(message.track);
}

export function isTranslateLyricsMessage(
  value: unknown,
): value is TranslateLyricsMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<TranslateLyricsMessage>;

  return message.type === 'lyra:translateLyrics' && Array.isArray(message.lines);
}

export function isGetLyricsCacheSummaryMessage(
  value: unknown,
): value is GetLyricsCacheSummaryMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (value as Partial<GetLyricsCacheSummaryMessage>).type === 'lyra:getLyricsCacheSummary';
}

export function isClearLyricsCacheMessage(value: unknown): value is ClearLyricsCacheMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (value as Partial<ClearLyricsCacheMessage>).type === 'lyra:clearLyricsCache';
}

export function requestLyrics(
  track: TrackIdentity,
  targetLanguage?: string,
): Promise<LyricsResult> {
  const extensionApi = getExtensionApi();
  const message: FetchLyricsMessage = {
    type: 'lyra:fetchLyrics',
    track,
    targetLanguage,
  };

  if (!extensionApi?.runtime) {
    return fetchFallbackLyrics(track, targetLanguage);
  }

  try {
    return Promise.resolve(extensionApi.runtime.sendMessage(message)).catch(
      (error: unknown) => handleMessageError(error, () =>
        fetchFallbackLyrics(track, targetLanguage),
      ),
    );
  } catch (error) {
    return handleMessageError(error, () => fetchFallbackLyrics(track, targetLanguage));
  }
}

export function requestOriginalLyrics(track: TrackIdentity): Promise<LyricsResult> {
  const extensionApi = getExtensionApi();
  const message: FetchOriginalLyricsMessage = {
    type: 'lyra:fetchOriginalLyrics',
    track,
  };

  if (!extensionApi?.runtime) {
    return fetchLyricsFromLrclib(track);
  }

  try {
    return Promise.resolve(extensionApi.runtime.sendMessage(message)).catch(
      (error: unknown) => handleMessageError(error, () => fetchLyricsFromLrclib(track)),
    );
  } catch (error) {
    return handleMessageError(error, () => fetchLyricsFromLrclib(track));
  }
}

export function requestTranslatedLyrics(
  lines: LyricLine[],
  targetLanguage?: string,
  source: LyricsResult['source'] = 'spotify',
): Promise<LyricsResult> {
  const extensionApi = getExtensionApi();
  const message: TranslateLyricsMessage = {
    type: 'lyra:translateLyrics',
    lines,
    targetLanguage,
    source,
  };

  if (!extensionApi?.runtime) {
    return translateLyricsResult(
      {
        status: 'monolingual',
        lines,
        source,
      },
      targetLanguage,
    );
  }

  try {
    return Promise.resolve(extensionApi.runtime.sendMessage(message)).catch(
      (error: unknown) =>
        handleMessageError(error, () =>
          translateLyricsResult(
            {
              status: 'monolingual',
              lines,
              source,
            },
            targetLanguage,
          ),
        ),
    );
  } catch (error) {
    return handleMessageError(error, () =>
      translateLyricsResult(
        {
          status: 'monolingual',
          lines,
          source,
        },
        targetLanguage,
      ),
    );
  }
}

export async function getLyricsCacheSummary(
  extensionApi: ExtensionApi = getExtensionApi(),
): Promise<CacheSummary> {
  const message: GetLyricsCacheSummaryMessage = {
    type: 'lyra:getLyricsCacheSummary',
  };

  if (!extensionApi?.runtime) {
    return {
      songCount: 0,
      entryCount: 0,
      maxEntries: 0,
      sizeBytes: 0,
    };
  }

  return extensionApi.runtime.sendMessage(message) as Promise<CacheSummary>;
}

export async function clearLyricsCache(
  extensionApi: ExtensionApi = getExtensionApi(),
): Promise<void> {
  const message: ClearLyricsCacheMessage = {
    type: 'lyra:clearLyricsCache',
  };

  if (!extensionApi?.runtime) {
    return;
  }

  await extensionApi.runtime.sendMessage(message);
}

function handleMessageError(
  error: unknown,
  fallback: () => Promise<LyricsResult>,
): Promise<LyricsResult> {
  if (isExtensionContextInvalidatedError(error)) {
    return Promise.resolve(unavailableLyricsResult);
  }

  console.warn('[Lyra] background unreachable, using direct lyrics flow', error);
  return fallback();
}

async function fetchFallbackLyrics(
  track: TrackIdentity,
  targetLanguage?: string,
): Promise<LyricsResult> {
  return translateLyricsResult(await fetchLyricsFromLrclib(track), targetLanguage);
}
