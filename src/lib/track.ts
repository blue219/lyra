import type { TrackIdentity } from './types';

export function normalizeTrackIdentity(track: TrackIdentity): TrackIdentity {
  return {
    title: normalizeSegment(track.title),
    artists: track.artists
      .map(normalizeSegment)
      .filter((artist) => artist.length > 0),
    album: track.album ? normalizeSegment(track.album) : undefined,
    durationSeconds: track.durationSeconds,
  };
}

export function createTrackCacheKey(track: TrackIdentity): string {
  const normalized = normalizeTrackIdentity(track);
  const keyParts = [
    normalized.title.toLocaleLowerCase(),
    normalized.artists.join(',').toLocaleLowerCase(),
    normalized.album?.toLocaleLowerCase() ?? '',
  ];

  if (normalized.durationSeconds !== undefined) {
    keyParts.push(normalized.durationSeconds.toString());
  }

  return keyParts.join('__');
}

function normalizeSegment(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
