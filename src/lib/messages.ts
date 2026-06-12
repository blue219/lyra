import { getExtensionApi, isExtensionContextInvalidatedError } from './extension-api';
import { fetchLyricsFromLrclib } from './lrclib';
import { translateLyricsResult } from './translate';
import type { LyricLine, LyricsResult, TrackIdentity } from './types';

export interface FetchLyricsMessage {
  type: 'lyra:fetchLyrics';
  track: TrackIdentity;
  targetLanguage?: string;
}

export interface TranslateLyricsMessage {
  type: 'lyra:translateLyrics';
  lines: LyricLine[];
  targetLanguage?: string;
  sourceLanguage?: string;
  source?: LyricsResult['source'];
}

const unavailableLyricsResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

export function isFetchLyricsMessage(value: unknown): value is FetchLyricsMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<FetchLyricsMessage>;

  return message.type === 'lyra:fetchLyrics' && Boolean(message.track);
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

export function requestTranslatedLyrics(
  lines: LyricLine[],
  targetLanguage?: string,
  sourceLanguage?: string,
  source: LyricsResult['source'] = 'spotify',
): Promise<LyricsResult> {
  const extensionApi = getExtensionApi();
  const message: TranslateLyricsMessage = {
    type: 'lyra:translateLyrics',
    lines,
    targetLanguage,
    sourceLanguage,
    source,
  };

  if (!extensionApi?.runtime) {
    return translateLyricsResult(
      {
        status: 'monolingual',
        lines,
        sourceLanguage,
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
              sourceLanguage,
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
          sourceLanguage,
          source,
        },
        targetLanguage,
      ),
    );
  }
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
