import { describe, expect, test } from 'vitest';

import { defaultOverlaySettings, sanitizeOverlaySettings } from './settings';

describe('sanitizeOverlaySettings', () => {
  const supportedTargetLanguages = [
    'en-US',
    'zh-CN',
    'zh-TW',
    'ja-JP',
    'ko-KR',
    'es-ES',
    'fr-FR',
    'de-DE',
    'pt-BR',
    'it-IT',
    'ru-RU',
    'id-ID',
  ];

  test('falls back to defaults when values are missing or invalid', () => {
    expect(
      sanitizeOverlaySettings({
        targetLanguage: '',
        fontSize: 'huge',
      }),
    ).toEqual(defaultOverlaySettings);
  });

  test('preserves every supported target language', () => {
    supportedTargetLanguages.forEach((targetLanguage) => {
      expect(
        sanitizeOverlaySettings({
          targetLanguage,
          fontSize: 'md',
        }),
      ).toEqual({
        targetLanguage,
        fontSize: 'md',
      });
    });
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

  test('falls back from unsupported language values', () => {
    expect(
      sanitizeOverlaySettings({
        targetLanguage: 'nl-NL',
        fontSize: 'md',
      }),
    ).toEqual(defaultOverlaySettings);

    expect(
      sanitizeOverlaySettings({
        targetLanguage: 'th-TH',
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
