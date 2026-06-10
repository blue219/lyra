import type { LyricsResult, TrackIdentity } from './types';
import { getExtensionApi, isExtensionContextInvalidatedError } from './extension-api';

export interface FetchLyricsMessage {
  type: 'lyra:fetchLyrics';
  track: TrackIdentity;
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

export function requestLyrics(track: TrackIdentity): Promise<LyricsResult> {
  const extensionApi = getExtensionApi();

  if (!extensionApi?.runtime) {
    return Promise.resolve(unavailableLyricsResult);
  }

  try {
    return Promise.resolve(
      extensionApi.runtime.sendMessage({
        type: 'lyra:fetchLyrics',
        track,
      }),
    ).catch((error: unknown) => {
      if (isExtensionContextInvalidatedError(error)) {
        return unavailableLyricsResult;
      }

      throw error;
    });
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return Promise.resolve(unavailableLyricsResult);
    }

    return Promise.reject(error);
  }
}
