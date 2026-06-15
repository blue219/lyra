// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import { clearInlineLyrics, renderInlineLyrics } from './inline-lyrics';
import type { LyricsResult } from '../../shared/types';

const bilingualLyrics: LyricsResult = {
  status: 'bilingual',
  source: 'spotify',
  lines: [
    {
      timeMs: 0,
      original: 'Hello',
      translated: '你好',
      translatedLanguage: 'zh-CN',
    },
    {
      timeMs: 1,
      original: 'World',
      translated: '世界',
      translatedLanguage: 'zh-CN',
    },
  ],
};

describe('renderInlineLyrics', () => {
  test('inserts translated lines inside matching Spotify lyric lines', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line">Hello</div>
        <div data-testid="lyrics-line">World</div>
      </section>
    `;

    renderInlineLyrics(document, bilingualLyrics, {
      fontSize: 'md',
      targetLanguage: 'zh-CN',
    });

    const lyricSection = document.querySelector('section');
    const firstLyricLine = document.querySelector('[data-testid="lyrics-line"]');

    expect(lyricSection?.children).toHaveLength(2);
    expect(firstLyricLine?.children).toHaveLength(1);
    expect(firstLyricLine?.children[0].textContent).toBe('你好');
    expect(firstLyricLine?.children[0].getAttribute('data-lyra-inline-translation')).toBe('true');
    expect((firstLyricLine?.children[0] as HTMLElement).style.fontFamily).toBe('inherit');
    expect((firstLyricLine?.children[0] as HTMLElement).style.fontWeight).toBe('inherit');
  });

  test('skips virtual Spotify lyric rows without original text', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line">
          <div></div>
        </div>
        <div data-testid="lyrics-line">
          <div>Hello</div>
        </div>
      </section>
    `;

    renderInlineLyrics(document, {
      status: 'bilingual',
      lines: [
        {
          timeMs: 0,
          original: 'Hello',
          translated: '你好',
          translatedLanguage: 'zh-CN',
        },
      ],
    }, {
      fontSize: 'md',
      targetLanguage: 'zh-CN',
    });

    const lyricLines = document.querySelectorAll('[data-testid="lyrics-line"]');

    expect(lyricLines[0].querySelector('[data-lyra-inline-translation]')).toBeNull();
    expect(lyricLines[1].querySelector('[data-lyra-inline-translation]')?.textContent).toBe(
      '你好',
    );
  });

  test('updates existing translations instead of inserting duplicates', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line">Hello</div>
        <div data-testid="lyrics-line">World</div>
      </section>
    `;

    renderInlineLyrics(document, bilingualLyrics, {
      fontSize: 'md',
      targetLanguage: 'zh-CN',
    });
    renderInlineLyrics(document, bilingualLyrics, {
      fontSize: 'lg',
      targetLanguage: 'zh-CN',
    });

    const translations = document.querySelectorAll('[data-lyra-inline-translation]');

    expect(translations).toHaveLength(2);
    expect(translations[0].className).toContain('lyra-inline-translation--lg');
  });

  test('inserts translations immediately after Spotify replaces lyric DOM nodes', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line">Hello</div>
      </section>
    `;

    renderInlineLyrics(document, bilingualLyrics, {
      fontSize: 'md',
      targetLanguage: 'zh-CN',
    });

    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line">Hello</div>
      </section>
    `;

    renderInlineLyrics(document, bilingualLyrics, {
      fontSize: 'md',
      targetLanguage: 'zh-CN',
    });

    const translation = document.querySelector('[data-lyra-inline-translation]');

    expect(translation?.textContent).toBe('你好');
    expect(document.querySelectorAll('[data-lyra-inline-translation]')).toHaveLength(1);
  });

  test('removes stale translations when no matching translated line exists', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line">
          Hello
          <div data-lyra-inline-translation="true">你好</div>
        </div>
      </section>
    `;

    renderInlineLyrics(document, { status: 'monolingual', lines: [] }, {
      fontSize: 'md',
      targetLanguage: 'zh-CN',
    });

    expect(document.querySelector('[data-lyra-inline-translation]')).toBeNull();
  });

  test('marks the active Spotify lyric line without changing layout styles', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div data-testid="lyrics-line">Hello</div>
        <div data-testid="lyrics-line">World</div>
      </section>
    `;

    renderInlineLyrics(document, bilingualLyrics, {
      activeLineIndex: 1,
      fontSize: 'md',
      targetLanguage: 'zh-CN',
    });

    const lyricLines = document.querySelectorAll<HTMLElement>('[data-testid="lyrics-line"]');

    expect(lyricLines[0].getAttribute('data-lyra-active-line')).toBeNull();
    expect(lyricLines[1].getAttribute('data-lyra-active-line')).toBe('true');
    expect(lyricLines[1].style.borderLeft).toBe('');
    expect(lyricLines[1].style.paddingLeft).toBe('');
    expect(lyricLines[1].style.boxShadow).toBe('inset 3px 0 0 #1ed760');
    expect(
      lyricLines[1].querySelector<HTMLElement>('[data-lyra-inline-translation]')?.style.color,
    ).toBe('rgb(30, 215, 96)');
    expect(
      lyricLines[0].querySelector<HTMLElement>('[data-lyra-inline-translation]')?.style.color,
    ).toBe('rgb(179, 179, 179)');
  });
});

describe('clearInlineLyrics', () => {
  test('removes all Lyra inline translations', () => {
    document.body.innerHTML = `
      <section aria-label="Lyrics">
        <div
          data-testid="lyrics-line"
          data-lyra-active-line="true"
          style="border-left: 3px solid rgb(30, 215, 96); padding-left: 14px;"
        >
          Hello
        </div>
        <div data-lyra-inline-translation="true">你好</div>
      </section>
    `;

    clearInlineLyrics(document);

    const lyricLine = document.querySelector<HTMLElement>('[data-testid="lyrics-line"]');

    expect(document.querySelector('[data-lyra-inline-translation]')).toBeNull();
    expect(lyricLine?.getAttribute('data-lyra-active-line')).toBeNull();
    expect(lyricLine?.style.borderLeft).toBe('');
  });
});
