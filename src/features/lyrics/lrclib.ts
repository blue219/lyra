import { toLyricsResult, type LrclibLyricsResponse } from './lyrics';
import { normalizeTrackIdentity } from '../spotify/track';
import type { LyricsResult, TrackIdentity } from '../../shared/types';

const lrclibApiBaseUrl = 'https://lrclib.net/api';
const lrclibClientName = 'Lyra 0.1.0';

const unavailableLyricsResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

export async function fetchLyricsFromLrclib(
  track: TrackIdentity,
): Promise<LyricsResult> {
  const normalizedTrack = normalizeTrackIdentity(track);
  const artistMatch = await fetchSearchLyricsMatch(normalizedTrack, true);

  if (artistMatch) {
    return toLyricsResult(artistMatch);
  }

  const trackOnlyMatch = await fetchSearchLyricsMatch(normalizedTrack, false);

  if (trackOnlyMatch) {
    return toLyricsResult(trackOnlyMatch);
  }

  return unavailableLyricsResult;
}

async function fetchSearchLyricsMatch(
  track: TrackIdentity,
  includeArtist: boolean,
): Promise<LrclibLyricsResponse | null> {
  const searchParams = new URLSearchParams({
    track_name: track.title,
  });

  if (includeArtist) {
    searchParams.set('artist_name', track.artists.join(', '));
  }

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
