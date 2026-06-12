import type { LyricLine, TrackIdentity } from '../../shared/types';

const trackLinkSelectors = [
  '[aria-label^="Now playing:"] a[href^="/album/"]',
  '[aria-label^="Now playing:"] a[href^="/track/"]',
  'footer a[href^="/track/"]',
  '[data-testid="now-playing-widget"] a[href^="/track/"]',
  'a[data-testid="context-item-link"][href^="/track/"]',
];

const fallbackTrackTitleSelectors = [
  '[data-testid="entity-details"] h1',
  '[data-testid="entity-details"] h2',
  'aside[aria-label*="Now playing"] h1',
  'aside[aria-label*="Now playing"] h2',
  'main aside h1',
];

const trackScopeSelectors = [
  'footer',
  '[data-testid="now-playing-widget"]',
  '[aria-label*="Now playing"]',
  '[data-testid="entity-details"]',
];

const spotifyLyricsLineSelectors = [
  '[data-testid="lyrics-line"]',
  '[data-lyric-index]',
];

export interface SpotifyLyricsSnapshot {
  lines: LyricLine[];
  activeLineIndex: number;
}

export interface SpotifyLyricEntry {
  element: HTMLElement;
  line: LyricLine;
}

export function readCurrentTrackIdentity(
  rootDocument: Document = document,
): TrackIdentity | null {
  const nowPlayingTrack = readTrackIdentityFromNowPlayingRegion(rootDocument);

  if (nowPlayingTrack) {
    return nowPlayingTrack;
  }

  const trackLink = findFirstVisibleElement(rootDocument, trackLinkSelectors);
  const title =
    trackLink?.textContent?.trim() ??
    findFirstVisibleText(rootDocument, fallbackTrackTitleSelectors);

  if (!title) {
    return null;
  }

  const scope =
    (trackLink
      ? trackScopeSelectors
          .map((selector) => trackLink.closest<HTMLElement>(selector))
          .find(Boolean)
      : null) ??
    findFirstVisibleContainer(rootDocument, trackScopeSelectors) ??
    trackLink?.closest<HTMLElement>('div') ??
    null;

  const artists = Array.from(
    scope?.querySelectorAll<HTMLAnchorElement>('a[href^="/artist/"]') ?? [],
  )
    .filter(isVisibleElement)
    .map((artistLink) => artistLink.textContent?.trim() ?? '')
    .filter((artist) => artist.length > 0);

  const album = Array.from(
    scope?.querySelectorAll<HTMLAnchorElement>('a[href^="/album/"]') ?? [],
  )
    .filter(isVisibleElement)
    .map((albumLink) => albumLink.textContent?.trim() ?? '')
    .find((value) => Boolean(value)) ?? findAlbumText(scope, title, artists);

  if (artists.length === 0) {
    return null;
  }

  return {
    title,
    artists: uniqueValues(artists),
    album,
    durationSeconds: readPlaybackDurationSeconds(rootDocument),
  };
}

export function readSpotifyLyricsSnapshot(
  rootDocument: Document = document,
): SpotifyLyricsSnapshot | null {
  const textLines = readVisibleSpotifyLyricEntries(rootDocument);

  if (textLines.length === 0) {
    return null;
  }

  return {
    activeLineIndex: textLines.findIndex((entry) => isActiveLyricElement(entry.element)),
    lines: textLines.map((entry) => entry.line),
  };
}

export function hasVisibleSpotifyLyrics(rootDocument: Document = document): boolean {
  return readVisibleSpotifyLyricEntries(rootDocument).length > 0;
}

export function readVisibleSpotifyLyricElements(
  rootDocument: Document = document,
): HTMLElement[] {
  return uniqueElements(
    spotifyLyricsLineSelectors.flatMap((selector) =>
      Array.from(rootDocument.querySelectorAll<HTMLElement>(selector)),
    ),
  ).filter(isVisibleElement);
}

export function readSpotifyLyricsContainer(
  rootDocument: Document = document,
): HTMLElement | null {
  const firstLyricElement = readVisibleSpotifyLyricElements(rootDocument)[0];

  if (!firstLyricElement) {
    return null;
  }

  return (
    firstLyricElement.closest<HTMLElement>('#main-view, .main-view-container') ??
    firstLyricElement.closest<HTMLElement>(
      'section[aria-label*="Lyrics"], [aria-label*="Lyrics"]',
    ) ??
    firstLyricElement.parentElement
  );
}

export function readVisibleSpotifyLyricEntries(
  rootDocument: Document = document,
): SpotifyLyricEntry[] {
  const lyricElements = readVisibleSpotifyLyricElements(rootDocument);

  return lyricElements
    .map((element, index) => ({
      element,
      line: {
        timeMs: index,
        original: normalizeLyricText(getSpotifyLyricText(element)),
      },
    }))
    .filter((entry) => entry.line.original.length > 0)
    .map((entry, index) => ({
      ...entry,
      line: {
        ...entry.line,
        timeMs: index,
      },
    }));
}

function getSpotifyLyricText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('[data-lyra-inline-translation="true"]').forEach((node) => {
    node.remove();
  });

  return clone.textContent ?? '';
}

function readTrackIdentityFromNowPlayingRegion(
  rootDocument: Document,
): TrackIdentity | null {
  const nowPlayingRegion = Array.from(
    rootDocument.querySelectorAll<HTMLElement>('[aria-label^="Now playing:"]'),
  ).find(isVisibleElement);

  if (!nowPlayingRegion) {
    return null;
  }

  const title = Array.from(
    nowPlayingRegion.querySelectorAll<HTMLAnchorElement>('a[href^="/album/"], a[href^="/track/"]'),
  )
    .filter(isVisibleElement)
    .map((link) => link.textContent?.trim() ?? '')
    .find((text) => text.length > 0);

  const artists = Array.from(
    nowPlayingRegion.querySelectorAll<HTMLAnchorElement>('a[href^="/artist/"]'),
  )
    .filter(isVisibleElement)
    .map((link) => link.textContent?.trim() ?? '')
    .filter((text) => text.length > 0);

  if (!title || artists.length === 0) {
    return null;
  }

  return {
    title,
    artists: uniqueValues(artists),
    durationSeconds: readPlaybackDurationSeconds(rootDocument),
  };
}

export function readPlaybackPositionMs(
  rootDocument: Document = document,
): number | null {
  const explicitPlaybackPosition = rootDocument.querySelector<HTMLElement>(
    '[data-testid="playback-position"]',
  );
  const explicitValue = parseTimestampToMs(
    explicitPlaybackPosition?.textContent ?? '',
  );

  if (explicitValue !== null) {
    return explicitValue;
  }

  const footer = rootDocument.querySelector('footer');

  if (!footer) {
    return null;
  }

  for (const candidate of footer.querySelectorAll<HTMLElement>('span, div')) {
    if (!isVisibleElement(candidate)) {
      continue;
    }

    const value = parseTimestampToMs(candidate.textContent ?? '');

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readPlaybackDurationSeconds(rootDocument: Document): number | undefined {
  const explicitPlaybackDuration = rootDocument.querySelector<HTMLElement>(
    '[data-testid="playback-duration"]',
  );
  const explicitValue = parseTimestampToMs(
    explicitPlaybackDuration?.textContent ?? '',
  );

  if (explicitValue !== null) {
    return Math.round(explicitValue / 1000);
  }

  const footer = rootDocument.querySelector('footer');

  if (!footer) {
    return undefined;
  }

  const timestamps = Array.from(footer.querySelectorAll<HTMLElement>('span, div'))
    .filter(isVisibleElement)
    .map((candidate) => parseTimestampToMs(candidate.textContent ?? ''))
    .filter((value): value is number => value !== null);

  if (timestamps.length < 2) {
    return undefined;
  }

  const durationMs = timestamps.at(-1);
  return durationMs === undefined ? undefined : Math.round(durationMs / 1000);
}

function findFirstVisibleElement(
  rootDocument: Document,
  selectors: string[],
): HTMLAnchorElement | null {
  for (const selector of selectors) {
    const match = Array.from(
      rootDocument.querySelectorAll<HTMLAnchorElement>(selector),
    ).find(isVisibleElement);

    if (match) {
      return match;
    }
  }

  return null;
}

function findFirstVisibleContainer(
  rootDocument: Document,
  selectors: string[],
): HTMLElement | null {
  for (const selector of selectors) {
    const match = Array.from(rootDocument.querySelectorAll<HTMLElement>(selector)).find(
      isVisibleElement,
    );

    if (match) {
      return match;
    }
  }

  return null;
}

function findFirstVisibleText(
  rootDocument: Document,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const match = Array.from(rootDocument.querySelectorAll<HTMLElement>(selector)).find(
      isVisibleElement,
    );

    const text = match?.textContent?.trim();

    if (text) {
      return text;
    }
  }

  return null;
}

function isVisibleElement(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const styles = window.getComputedStyle(htmlElement);

  return (
    styles.display !== 'none' &&
    styles.visibility !== 'hidden' &&
    styles.opacity !== '0'
  );
}

function findAlbumText(
  scope: HTMLElement | null,
  title: string,
  artists: string[],
): string | undefined {
  if (!scope) {
    return undefined;
  }

  const blockedValues = new Set([title, ...artists].map((value) => value.trim()));

  const candidates = Array.from(scope.querySelectorAll<HTMLElement>('div, span, p'))
    .filter(isVisibleElement)
    .map((element) => element.textContent?.trim() ?? '')
    .filter((text) => text.length > 0)
    .filter((text) => !blockedValues.has(text))
    .filter((text) => !/switch to video/i.test(text));

  return candidates.find(Boolean) || undefined;
}

function isActiveLyricElement(element: HTMLElement): boolean {
  const ariaCurrent = element.getAttribute('aria-current');
  const ariaSelected = element.getAttribute('aria-selected');
  const dataActive = element.getAttribute('data-active');
  const className = typeof element.className === 'string' ? element.className : '';

  return (
    ariaCurrent === 'true' ||
    ariaCurrent === 'step' ||
    ariaSelected === 'true' ||
    dataActive === 'true' ||
    /\b(active|current|selected)\b/i.test(className) ||
    window.getComputedStyle(element).color === 'rgb(255, 255, 255)'
  );
}

function normalizeLyricText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseTimestampToMs(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  if (match[3]) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return (minutes * 60 + seconds) * 1000;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function uniqueElements<T extends Element>(elements: T[]): T[] {
  return Array.from(new Set(elements));
}
