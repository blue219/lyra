import { toLyricsResult, type LrclibLyricsResponse } from '@/src/domain/lyrics';
import {
  normalizeTrackIdentity,
  normalizeTrackMatchText,
  splitNormalizedArtists,
} from '@/src/domain/track';
import type {
  LyricsResult,
  LyricsUnavailableReason,
  TrackIdentity,
} from '@/src/domain/model';
import { retryWithBackoff } from '@/src/application/retry';
import { createAttemptSignal, throwIfCancelled } from '@/src/application/abort';

const lrclibApiBaseUrl = 'https://lrclib.net/api';
const lrclibClientName = `Lyra ${__LYRA_VERSION__}`;

interface SearchOutcome {
  match: LrclibLyricsResponse | null;
  reason?: LyricsUnavailableReason;
}

type RequestOutcome<T> =
  { ok: true; value: T } | { ok: false; reason: LyricsUnavailableReason };

export async function fetchLyricsFromLrclib(
  track: TrackIdentity,
  signal: AbortSignal,
): Promise<LyricsResult> {
  const normalizedTrack = normalizeTrackIdentity(track);
  const artistSearch = await search(normalizedTrack, true, signal);

  if (artistSearch.match) return toLyricsResult(artistSearch.match);

  const trackOnlySearch = await search(normalizedTrack, false, signal);
  if (trackOnlySearch.match) return toLyricsResult(trackOnlySearch.match);

  return unavailable(
    trackOnlySearch.reason ?? artistSearch.reason ?? 'not-found',
  );
}

async function search(
  track: TrackIdentity,
  includeArtist: boolean,
  signal: AbortSignal,
): Promise<SearchOutcome> {
  const params = new URLSearchParams({ track_name: track.title });
  if (includeArtist) params.set('artist_name', track.artists.join(', '));

  const outcome = await requestJson(
    `${lrclibApiBaseUrl}/search?${params.toString()}`,
    signal,
  );
  if (!outcome.ok) return { match: null, reason: outcome.reason };
  if (!isLrclibResponseArray(outcome.value)) {
    return { match: null, reason: 'invalid-response' };
  }

  const identityMatches = outcome.value.filter((candidate) =>
    hasAcceptedIdentity(candidate, track),
  );
  const match = identityMatches.find(
    (candidate) =>
      !candidate.instrumental && Boolean(candidate.syncedLyrics?.trim()),
  );

  if (match) return { match };
  if (identityMatches.some((candidate) => candidate.instrumental)) {
    return { match: null, reason: 'instrumental' };
  }
  return { match: null };
}

function hasAcceptedIdentity(
  candidate: LrclibLyricsResponse,
  track: TrackIdentity,
): boolean {
  if (
    normalizeTrackMatchText(candidate.trackName) !==
    normalizeTrackMatchText(track.title)
  ) {
    return false;
  }

  const expectedArtists = new Set(
    track.artists.map(normalizeTrackMatchText).filter(Boolean),
  );
  const candidateArtists = splitNormalizedArtists(candidate.artistName);
  if (!candidateArtists.some((artist) => expectedArtists.has(artist))) {
    return false;
  }

  return !(
    track.durationSeconds !== undefined &&
    Number.isFinite(candidate.duration) &&
    Math.abs(track.durationSeconds - candidate.duration) > 5
  );
}

async function requestJson(
  url: string,
  signal: AbortSignal,
): Promise<RequestOutcome<unknown>> {
  try {
    const response = await retryWithBackoff({
      signal,
      operation: async () => {
        throwIfCancelled(signal);
        const attempt = createAttemptSignal(signal);
        try {
          const nextResponse = await fetch(url, {
            credentials: 'omit',
            headers: {
              Accept: 'application/json',
              'X-User-Agent': lrclibClientName,
              'Lrclib-Client': lrclibClientName,
            },
            signal: attempt.signal,
          });
          if (!nextResponse.ok) {
            throw new HttpStatusError(nextResponse.status);
          }
          return nextResponse;
        } catch (error) {
          if (signal.aborted) throwIfCancelled(signal);
          if (attempt.didTimeout()) throw new RequestTimeoutError();
          throw error;
        } finally {
          attempt.dispose();
        }
      },
      shouldRetry: (error) =>
        error instanceof TypeError ||
        error instanceof RequestTimeoutError ||
        (error instanceof HttpStatusError &&
          (error.status === 429 || error.status >= 500)),
    });

    try {
      return { ok: true, value: await response.json() };
    } catch {
      return { ok: false, reason: 'invalid-response' };
    }
  } catch (error) {
    if (signal.aborted) throwIfCancelled(signal);
    return { ok: false, reason: reasonFromError(error) };
  }
}

function reasonFromError(error: unknown): LyricsUnavailableReason {
  if (error instanceof RequestTimeoutError) return 'timeout';
  if (error instanceof TypeError) return 'network-error';
  if (error instanceof HttpStatusError && error.status === 429) {
    return 'rate-limited';
  }
  return 'provider-error';
}

function isLrclibResponseArray(
  value: unknown,
): value is LrclibLyricsResponse[] {
  return Array.isArray(value) && value.every(isLrclibResponse);
}

function isLrclibResponse(value: unknown): value is LrclibLyricsResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.trackName === 'string' &&
    typeof record.artistName === 'string' &&
    typeof record.duration === 'number' &&
    typeof record.instrumental === 'boolean' &&
    (record.albumName === undefined ||
      record.albumName === null ||
      typeof record.albumName === 'string') &&
    (record.plainLyrics === undefined ||
      record.plainLyrics === null ||
      typeof record.plainLyrics === 'string') &&
    (record.syncedLyrics === undefined ||
      record.syncedLyrics === null ||
      typeof record.syncedLyrics === 'string')
  );
}

function unavailable(reason: LyricsUnavailableReason): LyricsResult {
  return { status: 'unavailable', reason, lines: [] };
}

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`LRCLIB HTTP ${status}`);
  }
}

class RequestTimeoutError extends Error {}
