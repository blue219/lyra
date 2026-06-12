import { describe, expect, test } from 'vitest';

import { defaultOverlaySettings, sanitizeOverlaySettings } from './settings';

describe('sanitizeOverlaySettings', () => {
  test('falls back to defaults when values are missing or invalid', () => {
    expect(
      sanitizeOverlaySettings({
        targetLanguage: '',
        fontSize: 'huge',
      }),
    ).toEqual(defaultOverlaySettings);
  });

  test('preserves supported settings values', () => {
    expect(
      sanitizeOverlaySettings({
        targetLanguage: 'en-US',
        fontSize: 'lg',
      }),
    ).toEqual({
      targetLanguage: 'en-US',
      fontSize: 'lg',
    });
  });

  test('falls back from unsupported legacy language values', () => {
    expect(
      sanitizeOverlaySettings({
        targetLanguage: 'ja-JP',
        fontSize: 'md',
      }),
    ).toEqual(defaultOverlaySettings);

    expect(
      sanitizeOverlaySettings({
        targetLanguage: 'es-ES',
        fontSize: 'md',
      }),
    ).toEqual(defaultOverlaySettings);
  });

  test('preserves simplified Chinese as a supported target language', () => {
    expect(
      sanitizeOverlaySettings({
        targetLanguage: 'zh-CN',
        fontSize: 'sm',
      }),
    ).toEqual({
      targetLanguage: 'zh-CN',
      fontSize: 'sm',
    });
  });
});
