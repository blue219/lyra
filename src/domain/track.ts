import type { TrackIdentity } from '@/src/domain/model';

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

export function normalizeTrackMatchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitNormalizedArtists(value: string): string[] {
  return value
    .split(/\s*(?:,|;|\/|&|\bfeat\.?\b|\bfeaturing\b|\bft\.?\b)\s*/iu)
    .map(normalizeTrackMatchText)
    .filter(Boolean);
}

function normalizeSegment(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
