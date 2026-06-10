import { toLyricsResult, type LrclibLyricsResponse } from './lyrics';
import { normalizeTrackIdentity } from './track';
import type { LyricsResult, TrackIdentity } from './types';

const lrclibApiBaseUrl = 'https://lrclib.net/api';

const unavailableLyricsResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

export async function fetchLyricsFromLrclib(
  track: TrackIdentity,
): Promise<LyricsResult> {
  const normalizedTrack = normalizeTrackIdentity(track);
  const exactMatch = await fetchExactLyricsMatch(normalizedTrack);

  if (exactMatch) {
    return toLyricsResult(exactMatch);
  }

  const fallbackMatch = await fetchSearchLyricsMatch(normalizedTrack);

  if (fallbackMatch) {
    return toLyricsResult(fallbackMatch);
  }

  const trackOnlyFallbackMatch = await fetchTrackOnlySearchMatch(normalizedTrack);

  if (trackOnlyFallbackMatch) {
    return toLyricsResult(trackOnlyFallbackMatch);
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

  return requestLrclibJson<LrclibLyricsResponse>(
    `${lrclibApiBaseUrl}/get?${searchParams.toString()}`,
  );
}

async function fetchSearchLyricsMatch(
  track: TrackIdentity,
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

  return selectBestMatch(matches, track);
}

async function fetchTrackOnlySearchMatch(
  track: TrackIdentity,
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

  return selectBestMatch(matches, track);
}

async function requestLrclibJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function scoreMatch(candidate: LrclibLyricsResponse, track: TrackIdentity): number {
  const normalizedTitle = track.title.toLocaleLowerCase();
  const normalizedArtists = track.artists.map((artist) => artist.toLocaleLowerCase());
  const candidateTitle = candidate.trackName.toLocaleLowerCase();
  const candidateArtist = candidate.artistName.toLocaleLowerCase();
  const candidateAlbum = candidate.albumName?.toLocaleLowerCase() ?? '';

  let score = candidate.syncedLyrics ? 10 : 0;

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
  return matches
    .slice()
    .sort((left, right) => scoreMatch(right, track) - scoreMatch(left, track))[0] ?? null;
}
