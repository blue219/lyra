import {
  getLineTranslationForLanguage,
  toLyricsResult,
  type LrclibLyricsResponse,
} from './lyrics';
import { translateLyricLines } from './translate';
import { normalizeTrackIdentity } from './track';
import type { LyricsResult, TrackIdentity } from './types';

const lrclibApiBaseUrl = 'https://lrclib.net/api';
const lrclibClientName = 'Lyra 0.1.0';

const unavailableLyricsResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

export async function fetchLyricsFromLrclib(
  track: TrackIdentity,
  targetLanguage?: string,
): Promise<LyricsResult> {
  const normalizedTrack = normalizeTrackIdentity(track);
  const exactMatch = await fetchExactLyricsMatch(normalizedTrack);

  if (exactMatch && hasRequestedTranslation(exactMatch, targetLanguage)) {
    return toLyricsResult(exactMatch, targetLanguage);
  }

  const fallbackMatch = await fetchSearchLyricsMatch(normalizedTrack, targetLanguage);

  if (fallbackMatch && hasRequestedTranslation(fallbackMatch, targetLanguage)) {
    return toLyricsResult(fallbackMatch, targetLanguage);
  }

  if (exactMatch && !targetLanguage) {
    return toLyricsResult(exactMatch);
  }

  const trackOnlyFallbackMatch = await fetchTrackOnlySearchMatch(
    normalizedTrack,
    targetLanguage,
  );

  if (trackOnlyFallbackMatch) {
    if (hasRequestedTranslation(trackOnlyFallbackMatch, targetLanguage)) {
      return toLyricsResult(trackOnlyFallbackMatch, targetLanguage);
    }
  }

  if (exactMatch) {
    return tryMachineTranslation(toLyricsResult(exactMatch, targetLanguage), targetLanguage);
  }

  if (fallbackMatch) {
    return tryMachineTranslation(toLyricsResult(fallbackMatch, targetLanguage), targetLanguage);
  }

  return unavailableLyricsResult;
}

async function fetchExactLyricsMatch(
  track: TrackIdentity,
): Promise<LrclibLyricsResponse | null> {
  const searchParams = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artists.join(', '),
  });

  if (track.album) {
    searchParams.set('album_name', track.album);
  }

  if (track.durationSeconds !== undefined) {
    searchParams.set('duration', track.durationSeconds.toString());
  }

  return requestLrclibJson<LrclibLyricsResponse>(
    `${lrclibApiBaseUrl}/get?${searchParams.toString()}`,
  );
}

async function fetchSearchLyricsMatch(
  track: TrackIdentity,
  targetLanguage?: string,
): Promise<LrclibLyricsResponse | null> {
  const searchParams = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artists.join(', '),
  });

  const matches = await requestLrclibJson<LrclibLyricsResponse[]>(
    `${lrclibApiBaseUrl}/search?${searchParams.toString()}`,
  );

  if (!matches?.length) {
    return null;
  }

  return selectBestMatch(matches, track, targetLanguage);
}

async function fetchTrackOnlySearchMatch(
  track: TrackIdentity,
  targetLanguage?: string,
): Promise<LrclibLyricsResponse | null> {
  const searchParams = new URLSearchParams({
    track_name: track.title,
  });

  const matches = await requestLrclibJson<LrclibLyricsResponse[]>(
    `${lrclibApiBaseUrl}/search?${searchParams.toString()}`,
  );

  if (!matches?.length) {
    return null;
  }

  return selectBestMatch(matches, track, targetLanguage);
}

async function requestLrclibJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-User-Agent': lrclibClientName,
        'Lrclib-Client': lrclibClientName,
      },
    });

    if (!response.ok) {
      console.error(`[Lyra] LRCLIB ${response.status} for ${url}`);
      return null;
    }

    return (await response.json()) as T;
  } catch {
    console.error(`[Lyra] LRCLIB fetch error for ${url}`);
    return null;
  }
}

function scoreMatch(candidate: LrclibLyricsResponse, track: TrackIdentity, targetLanguage?: string): number {
  const normalizedTitle = track.title.toLocaleLowerCase();
  const normalizedArtists = track.artists.map((artist) => artist.toLocaleLowerCase());
  const candidateTitle = candidate.trackName.toLocaleLowerCase();
  const candidateArtist = candidate.artistName.toLocaleLowerCase();
  const candidateAlbum = candidate.albumName?.toLocaleLowerCase() ?? '';

  let score = candidate.syncedLyrics ? 10 : 0;

  if (hasRequestedTranslation(candidate, targetLanguage)) {
    score += 20;
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
  targetLanguage?: string,
): LrclibLyricsResponse | null {
  return matches
    .slice()
    .sort(
      (left, right) =>
        scoreMatch(right, track, targetLanguage) -
        scoreMatch(left, track, targetLanguage),
    )[0] ?? null;
}

function hasRequestedTranslation(
  candidate: LrclibLyricsResponse,
  targetLanguage?: string,
): boolean {
  if (!targetLanguage) {
    return true;
  }

  const result = toLyricsResult(candidate, targetLanguage);

  return result.lines.some((line) =>
    Boolean(getLineTranslationForLanguage(line, targetLanguage)),
  );
}

/** When the best LRCLIB match is monolingual but the user has selected a
 *  different target language, attempt machine translation. Falls back
 *  gracefully to the original monolingual result. */
async function tryMachineTranslation(
  result: LyricsResult,
  targetLanguage?: string,
): Promise<LyricsResult> {
  if (
    result.status !== 'monolingual' ||
    !targetLanguage ||
    !result.sourceLanguage ||
    result.lines.length === 0
  ) {
    return result;
  }

  const sourceCode = result.sourceLanguage.split('-')[0];
  const targetCode = targetLanguage.split('-')[0];

  if (sourceCode === targetCode) {
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
    status: hasAnyTranslation ? 'bilingual' : result.status,
    lines: translatedLines,
  };
}
