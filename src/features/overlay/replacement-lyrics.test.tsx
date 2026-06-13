// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { ReplacementLyrics } from './replacement-lyrics';
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
      timeMs: 1_000,
      original: 'World',
      translated: '世界',
      translatedLanguage: 'zh-CN',
    },
  ],
};

describe('ReplacementLyrics', () => {
  test('shows Native as the source label for synced Spotify lyrics', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={1}
        fontSize="md"
        lyrics={bilingualLyrics}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('Source: Native');
  });

  test('shows LRCLIB as the source label for fallback lyrics', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={0}
        fontSize="md"
        lyrics={{
          ...bilingualLyrics,
          source: 'lrclib',
        }}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('Source: LRCLIB');
  });

  test('renders original and translated lyric lines with the active row marked', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={1}
        fontSize="md"
        lyrics={bilingualLyrics}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('Hello');
    expect(html).toContain('你好');
    expect(html).toContain('World');
    expect(html).toContain('世界');
    expect(html).toContain('data-lyra-replacement-active="true"');
  });

  test('renders the lyrics area as a scrollable region', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={0}
        fontSize="md"
        lyrics={bilingualLyrics}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('overflow-y:auto');
    expect(html).toContain('data-lyra-replacement-scroll="true"');
  });

  test('renders lyric rows as clickable controls with a pointer cursor', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={0}
        fontSize="md"
        lyrics={bilingualLyrics}
        targetLanguage="zh-CN"
        onLineSelect={() => undefined}
      />,
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('cursor:pointer');
  });

  test('disables text selection inside the replacement lyrics area', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={0}
        fontSize="md"
        lyrics={bilingualLyrics}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('user-select:none');
  });

  test('calls the line selection handler when a lyric row is clicked', () => {
    const selectedIndexes: number[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <ReplacementLyrics
          activeLineIndex={0}
          fontSize="md"
          lyrics={bilingualLyrics}
          targetLanguage="zh-CN"
          onLineSelect={(index) => selectedIndexes.push(index)}
        />,
      );
    });

    container
      .querySelectorAll<HTMLElement>('.lyra-replacement-line')
      .item(1)
      .click();

    expect(selectedIndexes).toEqual([1]);

    act(() => {
      root.unmount();
    });
  });

  test('renders a readable unavailable state', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={-1}
        fontSize="md"
        lyrics={{ status: 'unavailable', lines: [] }}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('No lyrics available');
    expect(html).toContain('No synced lyrics available');
  });
});
