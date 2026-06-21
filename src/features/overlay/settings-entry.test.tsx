// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import {
  SettingsEntry,
  getPhaseLabel,
  getSettingsEntryStyle,
} from './settings-entry';
import type {
  CacheSummary,
  LyricsResult,
  OverlaySettings,
} from '../../shared/types';

const settings: OverlaySettings = {
  targetLanguage: 'zh-CN',
  fontSize: 'md',
  dynamicBackground: true,
};

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
  ],
};

const cacheSummary: CacheSummary = {
  songCount: 12,
  entryCount: 14,
  maxEntries: 200,
  sizeBytes: 3_584,
};

describe('SettingsEntry', () => {
  test('renders the settings trigger without the popover by default', () => {
    const html = renderToStaticMarkup(
      <SettingsEntry
        anchor={null}
        cacheSummary={cacheSummary}
        isOpen={false}
        isCachePending={false}
        isClearingCache={false}
        lyrics={bilingualLyrics}
        phase="ready"
        settings={settings}
        onClearCache={() => undefined}
        onOpenChange={() => undefined}
        onSettingsChange={() => undefined}
      />,
    );

    expect(html).toContain('Open Lyra settings');
    expect(html).not.toContain('Target language');
  });

  test('renders language, font size, and phase controls when open', () => {
    const html = renderToStaticMarkup(
      <SettingsEntry
        anchor={{ right: 24, top: 48 }}
        isOpen
        lyrics={bilingualLyrics}
        phase="loading-translation"
        settings={settings}
        cacheSummary={cacheSummary}
        isCachePending={false}
        isClearingCache={false}
        onOpenChange={() => undefined}
        onSettingsChange={() => undefined}
        onClearCache={() => undefined}
      />,
    );

    expect(html).toContain('Target language');
    expect(html).toContain('Chinese (Simplified)');
    expect(html).toContain('Chinese (Traditional)');
    expect(html).toContain('Japanese');
    expect(html).toContain('Korean');
    expect(html).toContain('Spanish');
    expect(html).toContain('Font size');
    expect(html).toContain('Dynamic background');
    expect(html).toContain('Cache');
    expect(html).toContain('Cached songs');
    expect(html).toContain('12/200');
    expect(html).toContain('Cache size');
    expect(html).toContain('3.5 KB');
    expect(html).toContain('Clear');
    expect(html).toContain('bg-[#ff1010]');
    expect(html).toContain('rounded-[999px] bg-[#ff1010]');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Loading lyric translation.');
    expect(html).toContain('right:24px');
    expect(html).toContain('top:48px');
    expect(html).toContain('h-10 w-10');
    expect(html).toContain('rounded-full');
    expect(html).toContain('<img');
    expect(html).toContain('w-[min(88vw,274px)]');
    expect(html).toContain('p-4');
    expect(html).toContain('rounded-[24px]');
    expect(html).toContain('tracking-[4px]');
    expect(html).toContain('rounded-[999px]');
    expect(html).toContain('bg-[var(--lyra-color-accent)] text-black');
    expect(html).toContain('data-lyra-settings-notch="true"');
    expect(html).toContain('text-[10px]');
    expect(html).toContain('text-[0.82rem]');
    expect(html).toContain('text-[0.78rem]');
    expect(html).toContain('text-[0.8rem]');
    expect(html).toContain('p-1');
    expect(html).toContain('object-contain');
    expect(html).toContain('right-[14px]');
    expect(html).toContain('h-4 w-4');
    expect(html).toContain('pr-[10px]');
    expect(html).not.toContain('border-t border-white/10');
    expect(html).not.toContain('Falls back to static when motion should be reduced.');
  });

  test('renders the dynamic background switch as off when disabled', () => {
    const html = renderToStaticMarkup(
      <SettingsEntry
        anchor={null}
        isOpen
        lyrics={bilingualLyrics}
        phase="ready"
        settings={{ ...settings, dynamicBackground: false }}
        cacheSummary={cacheSummary}
        isCachePending={false}
        isClearingCache={false}
        onOpenChange={() => undefined}
        onSettingsChange={() => undefined}
        onClearCache={() => undefined}
      />,
    );

    expect(html).toContain('Dynamic background');
    expect(html).toContain('aria-checked="false"');
  });
});

describe('getSettingsEntryStyle', () => {
  test('uses a fixed fallback position without an anchor', () => {
    expect(getSettingsEntryStyle(null)).toEqual({
      right: 16,
      top: 16,
    });
  });
});

describe('getPhaseLabel', () => {
  test('describes monolingual ready lyrics', () => {
    expect(
      getPhaseLabel('ready', {
        status: 'monolingual',
        source: 'spotify',
        lines: [{ timeMs: 0, original: 'Hello' }],
      }),
    ).toBe('Showing original lyrics only for this language pair.');
  });
});
