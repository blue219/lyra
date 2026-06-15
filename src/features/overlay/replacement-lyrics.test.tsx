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
        phase="ready"
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
        phase="ready"
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
        phase="ready"
        lyrics={bilingualLyrics}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('Hello');
    expect(html).toContain('你好');
    expect(html).toContain('World');
    expect(html).toContain('世界');
    expect(html).toContain('data-lyra-replacement-active="true"');
    expect(html).toContain('border-left:3px solid #1ed760');
    expect(html).toContain('padding-left:14px');
    expect(html).toContain('color:#1ed760');
  });

  test('renders the lyrics area as a scrollable region', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={0}
        fontSize="md"
        phase="ready"
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
        phase="ready"
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
        phase="ready"
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
          phase="ready"
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

  test('renders loading lyrics skeleton rows', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={-1}
        fontSize="md"
        phase="loading-lyrics"
        lyrics={{ status: 'unavailable', lines: [] }}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('loading lyrics ...');
    expect(html).toContain('lyra-loading-status');
    expect(html).toContain('lyra-loading-mark');
    expect(html).toContain('lyra-loading-mark-bar');
    expect(html).toContain('font-size:0.96rem');
    expect(html).toContain('height:8px');
    expect(html).toContain('height:18px');
    expect(html).toContain('height:30px');
    expect(html).toContain('width:6px');
    expect(html).toContain('width:8px');
    expect(html).toContain('width:10px');
    expect(html).toContain('text-transform:none');
    expect((html.match(/lyra-skeleton-group/g) ?? []).length).toBe(5);
    expect((html.match(/class=\"lyra-skeleton-line\"/g) ?? []).length).toBe(5);
    expect((html.match(/class=\"lyra-skeleton-line lyra-skeleton-line--translation\"/g) ?? []).length).toBe(5);
    expect(html).toContain('overflow:hidden');
    expect(html).toContain('position:relative');
    expect(html).toContain('lyra-skeleton-beam');
    expect(html).toContain('padding:24px clamp(20px, 4vw, 48px) 64px');
    expect(html).toContain('max-width:1024px');
    expect(html).toContain('width:100%');
    expect(html).toContain('width:66.6667%');
    expect(html).toContain('width:33.3333%');
    expect(html).toContain('width:28%');
    expect(html).toContain('transform:translateX(-160%)');
    expect(html).not.toContain('No synced lyrics available');
  });

  test('renders original lines with translation placeholders while translation loads', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={-1}
        fontSize="md"
        phase="loading-translation"
        lyrics={{
          status: 'monolingual',
          source: 'spotify',
          lines: [
            { timeMs: 0, original: 'Hello' },
            { timeMs: 1_000, original: 'World' },
          ],
        }}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('loading translation ...');
    expect(html).toContain('lyra-loading-status');
    expect(html).toContain('lyra-loading-mark');
    expect(html).toContain('lyra-loading-mark-bar');
    expect(html).toContain('font-size:0.96rem');
    expect(html).toContain('height:8px');
    expect(html).toContain('height:18px');
    expect(html).toContain('height:30px');
    expect(html).toContain('width:6px');
    expect(html).toContain('width:8px');
    expect(html).toContain('width:10px');
    expect(html).toContain('text-transform:none');
    expect(html).toContain('Hello');
    expect(html).toContain('World');
    expect(html).toContain('lyra-skeleton-line lyra-skeleton-line--translation');
    expect(html).toContain('lyra-skeleton-beam');
    expect(html).toContain('width:33.3333%');
    expect(html).toContain('width:28%');
    expect(html).toContain('transform:translateX(-160%)');
  });

  test('renders a lightweight unavailable state', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={-1}
        fontSize="md"
        phase="unavailable"
        lyrics={{ status: 'unavailable', lines: [] }}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('No lyrics available');
    expect(html).not.toContain('No synced lyrics available');
  });
});
