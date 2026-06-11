import type { LyricsResult, TrackIdentity } from './types';
import { getExtensionApi, isExtensionContextInvalidatedError } from './extension-api';
import { fetchLyricsFromLrclib } from './lrclib';

export interface FetchLyricsMessage {
  type: 'lyra:fetchLyrics';
  track: TrackIdentity;
  targetLanguage?: string;
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

export function requestLyrics(
  track: TrackIdentity,
  targetLanguage?: string,
): Promise<LyricsResult> {
  const extensionApi = getExtensionApi();

  if (!extensionApi?.runtime) {
    return Promise.resolve(unavailableLyricsResult);
  }

  try {
    return Promise.resolve(
      extensionApi.runtime.sendMessage({
        type: 'lyra:fetchLyrics',
        track,
        targetLanguage,
      }),
    ).catch((error: unknown) => {
      if (isExtensionContextInvalidatedError(error)) {
        return unavailableLyricsResult;
      }

      // Background service worker may be terminated; fall back to direct fetch.
      console.warn('[Lyra] background unreachable, fetching directly', error);
      return fetchLyricsFromLrclib(track, targetLanguage);
    });
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return Promise.resolve(unavailableLyricsResult);
    }

    // sendMessage threw synchronously; fall back to direct fetch.
    console.warn('[Lyra] background unreachable, fetching directly', error);
    return fetchLyricsFromLrclib(track, targetLanguage);
  }
}
