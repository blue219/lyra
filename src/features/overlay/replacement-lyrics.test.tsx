import { renderToStaticMarkup } from 'react-dom/server';
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

  test('renders a readable unavailable state', () => {
    const html = renderToStaticMarkup(
      <ReplacementLyrics
        activeLineIndex={-1}
        fontSize="md"
        lyrics={{ status: 'unavailable', lines: [] }}
        targetLanguage="zh-CN"
      />,
    );

    expect(html).toContain('No synced lyrics available');
  });
});
