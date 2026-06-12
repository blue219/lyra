// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
  readCurrentTrackIdentity,
  readPlaybackPositionMs,
  readSpotifyLyricsSnapshot,
} from './spotify-dom';

describe('readCurrentTrackIdentity', () => {
  test('prefers the now playing bar song over the sidebar playlist heading', () => {
    document.body.innerHTML = `
      <aside>
        <h1>日本动漫经典歌曲</h1>
        <a href="/playlist/3xTVfDpq532fKod3mqRfXa">日本动漫经典歌曲</a>
      </aside>
      <div aria-label="Now playing: Home Sweet Home by YUKI">
        <a href="/album/2vdO2JMP1Oiko95nJHU8ej">Home Sweet Home</a>
        <a href="/artist/380DW51qbu5pSP8crFRIII">YUKI</a>
      </div>
      <div aria-label="Now playing bar">
        <span data-testid="playback-position">2:16</span>
        <span data-testid="playback-duration">3:49</span>
      </div>
    `;

    expect(readCurrentTrackIdentity(document)).toEqual({
      title: 'Home Sweet Home',
      artists: ['YUKI'],
      album: undefined,
      durationSeconds: 229,
    });
  });

  test('reads track metadata from the right sidebar details when the title is not a /track link', () => {
    document.body.innerHTML = `
      <main>
        <aside aria-label="Now playing view">
          <section data-testid="entity-details">
            <h1>One Last Time</h1>
            <div>
              <a href="/artist/66CXWjxzNUsdJxJ2JdwvnR">Ariana Grande</a>
            </div>
            <div>my everything tenth anniversary edition</div>
          </section>
        </aside>
      </main>
    `;

    expect(readCurrentTrackIdentity(document)).toEqual({
      title: 'One Last Time',
      artists: ['Ariana Grande'],
      album: 'my everything tenth anniversary edition',
      durationSeconds: undefined,
    });
  });
});

describe('readPlaybackPositionMs', () => {
  test('reads playback position from the standard player timestamp', () => {
    document.body.innerHTML = `
      <footer>
        <span data-testid="playback-position">1:23</span>
      </footer>
    `;

    expect(readPlaybackPositionMs(document)).toBe(83_000);
  });

  test('does not treat a lone playback position as track duration', () => {
    document.body.innerHTML = `
      <div aria-label="Now playing: Home Sweet Home by YUKI">
        <a href="/album/2vdO2JMP1Oiko95nJHU8ej">Home Sweet Home</a>
        <a href="/artist/380DW51qbu5pSP8crFRIII">YUKI</a>
      </div>
      <footer>
        <span data-testid="playback-position">1:23</span>
      </footer>
    `;

    expect(readCurrentTrackIdentity(document)).toEqual({
      title: 'Home Sweet Home',
      artists: ['YUKI'],
      album: undefined,
      durationSeconds: undefined,
    });
  });
});

describe('readSpotifyLyricsSnapshot', () => {
  test('reads visible Spotify lyric lines and the active line index', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line">Hello</div>
        <div data-testid="lyrics-line" aria-current="true">World</div>
      </section>
    `;

    expect(readSpotifyLyricsSnapshot(document)).toEqual({
      activeLineIndex: 1,
      lines: [
        { timeMs: 0, original: 'Hello' },
        { timeMs: 1, original: 'World' },
      ],
    });
  });

  test('returns null when no Spotify lyric lines are visible', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line" style="display: none">Hidden</div>
      </section>
    `;

    expect(readSpotifyLyricsSnapshot(document)).toBeNull();
  });
});
