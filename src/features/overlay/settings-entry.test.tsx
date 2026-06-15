// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import {
  SettingsEntry,
  getPhaseLabel,
  getSettingsEntryStyle,
} from './settings-entry';
import type { LyricsResult, OverlaySettings } from '../../shared/types';

const settings: OverlaySettings = {
  targetLanguage: 'zh-CN',
  fontSize: 'md',
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

describe('SettingsEntry', () => {
  test('renders the settings trigger without the popover by default', () => {
    const html = renderToStaticMarkup(
      <SettingsEntry
        anchor={null}
        isOpen={false}
        lyrics={bilingualLyrics}
        phase="ready"
        settings={settings}
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
        phase="ready"
        settings={settings}
        onOpenChange={() => undefined}
        onSettingsChange={() => undefined}
      />,
    );

    expect(html).toContain('Target language');
    expect(html).toContain('Chinese (Simplified)');
    expect(html).toContain('Font size');
    expect(html).toContain('Lyra lyrics are synced with playback.');
    expect(html).toContain('right:24px');
    expect(html).toContain('top:48px');
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
