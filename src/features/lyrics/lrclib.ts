import { toLyricsResult, type LrclibLyricsResponse } from './lyrics';
import { normalizeTrackIdentity } from '../spotify/track';
import type { LyricsResult, LyricsUnavailableReason, TrackIdentity } from '../../shared/types';
import { retryWithBackoff } from '../../shared/retry';

const lrclibApiBaseUrl = 'https://lrclib.net/api';
const lrclibClientName = 'Lyra 0.1.0';

const notFoundLyricsResult: LyricsResult = {
  status: 'unavailable',
  unavailableReason: 'not-found',
  lines: [],
};

interface LrclibSearchResult {
  match: LrclibLyricsResponse | null;
  failureReason?: LyricsUnavailableReason;
}

type LrclibRequestResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: LyricsUnavailableReason };

export async function fetchLyricsFromLrclib(
  track: TrackIdentity,
): Promise<LyricsResult> {
  const normalizedTrack = normalizeTrackIdentity(track);
  const artistSearch = await fetchSearchLyricsMatch(normalizedTrack, true);

  if (artistSearch.match) {
    return toLyricsResult(artistSearch.match);
  }

  const trackOnlySearch = await fetchSearchLyricsMatch(normalizedTrack, false);

  if (trackOnlySearch.match) {
    return toLyricsResult(trackOnlySearch.match);
  }

  return trackOnlySearch.failureReason
    ? createUnavailableLyricsResult(trackOnlySearch.failureReason)
    : notFoundLyricsResult;
}

async function fetchSearchLyricsMatch(
  track: TrackIdentity,
  includeArtist: boolean,
): Promise<LrclibSearchResult> {
  const searchParams = new URLSearchParams({
    track_name: track.title,
  });

  if (includeArtist) {
    searchParams.set('artist_name', track.artists.join(', '));
  }

  const result = await requestLrclibJson<LrclibLyricsResponse[]>(
    `${lrclibApiBaseUrl}/search?${searchParams.toString()}`,
  );

  if (!result.ok) {
    return { match: null, failureReason: result.reason };
  }

  const matches = result.value;

  if (!matches?.length) {
    return { match: null };
  }

  return { match: selectBestMatch(matches, track) };
}

async function requestLrclibJson<T>(url: string): Promise<LrclibRequestResult<T>> {
  try {
    const response = await retryWithBackoff({
      operation: async () => {
        const nextResponse = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'X-User-Agent': lrclibClientName,
            'Lrclib-Client': lrclibClientName,
          },
        });

        if (!nextResponse.ok) {
          throw new HttpStatusError(`LRCLIB ${nextResponse.status} for ${url}`, nextResponse.status);
        }

        return nextResponse;
      },
      shouldRetry: isTransientRequestError,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        console.warn(
          `[Lyra] LRCLIB transient failure on attempt ${attempt}/${maxAttempts}; retrying in ${delayMs}ms for ${url}:`,
          error,
        );
      },
    });

    try {
      return { ok: true, value: (await response.json()) as T };
    } catch (error) {
      console.error(`[Lyra] LRCLIB response could not be parsed for ${url}:`, error);
      return { ok: false, reason: 'invalid-response' };
    }
  } catch (error) {
    console.error(`[Lyra] LRCLIB request failed after retry exhaustion or a non-retryable error for ${url}:`, error);
    return { ok: false, reason: getUnavailableReasonFromError(error) };
  }
}

function createUnavailableLyricsResult(reason: LyricsUnavailableReason): LyricsResult {
  return {
    status: 'unavailable',
    unavailableReason: reason,
    lines: [],
  };
}

function isTransientRequestError(error: unknown): boolean {
  return error instanceof TypeError || isRetryableHttpStatusError(error);
}

function isRetryableHttpStatusError(error: unknown): boolean {
  return error instanceof HttpStatusError && (error.status === 429 || error.status >= 500);
}

function getUnavailableReasonFromError(error: unknown): LyricsUnavailableReason {
  if (error instanceof TypeError) {
    return 'network-error';
  }

  if (error instanceof HttpStatusError) {
    if (error.status === 429) {
      return 'rate-limited';
    }

    return 'provider-error';
  }

  return 'provider-error';
}

class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

function scoreMatch(candidate: LrclibLyricsResponse, track: TrackIdentity): number {
  const normalizedTitle = track.title.toLocaleLowerCase();
  const normalizedArtists = track.artists.map((artist) => artist.toLocaleLowerCase());
  const candidateTitle = candidate.trackName.toLocaleLowerCase();
  const candidateArtist = candidate.artistName.toLocaleLowerCase();
  const candidateAlbum = candidate.albumName?.toLocaleLowerCase() ?? '';

  let score = candidate.syncedLyrics ? 10 : 0;

  if (candidate.instrumental) {
    score -= 20;
  }

  if (candidateTitle === normalizedTitle) {
    score += 6;
  }

  if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
    score += 3;
  }

  if (normalizedArtists.some((artist) => candidateArtist.includes(artist))) {
    score += 4;
  }

  if (track.album && candidateAlbum === track.album.toLocaleLowerCase()) {
    score += 2;
  }

  return score;
}

function selectBestMatch(
  matches: LrclibLyricsResponse[],
  track: TrackIdentity,
): LrclibLyricsResponse | null {
  return (
    matches
      .filter((match) => Boolean(match.syncedLyrics?.trim()) && !match.instrumental)
      .slice()
      .sort((left, right) => scoreMatch(right, track) - scoreMatch(left, track))[0] ??
    null
  );
}
