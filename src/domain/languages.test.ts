import { describe, expect, test } from 'vitest';

import {
  fromGoogleTranslateLanguage,
  toGoogleTranslateLanguage,
} from './language-codes';
import { findSupportedLanguage, isSameSupportedLanguage } from './languages';

describe('supported languages', () => {
  test('resolves canonical values, provider codes, aliases, and unknown values', () => {
    expect(findSupportedLanguage(undefined)).toBeUndefined();
    expect(findSupportedLanguage('fr-FR')?.value).toBe('fr-FR');
    expect(findSupportedLanguage('fr')?.value).toBe('fr-FR');
    expect(findSupportedLanguage('zh-Hans')?.value).toBe('zh-CN');
    expect(findSupportedLanguage('unknown')).toBeUndefined();
    expect(toGoogleTranslateLanguage('zh-CN')).toBe('zh-CN');
    expect(toGoogleTranslateLanguage('unknown')).toBeNull();
    expect(fromGoogleTranslateLanguage('pt-PT')).toBe('pt-BR');
    expect(fromGoogleTranslateLanguage('unknown')).toBeUndefined();
  });

  test('compares only resolved languages', () => {
    expect(isSameSupportedLanguage('en', 'en-US')).toBe(true);
    expect(isSameSupportedLanguage(undefined, 'en')).toBe(false);
    expect(isSameSupportedLanguage('en', undefined)).toBe(false);
    expect(isSameSupportedLanguage('unknown', 'unknown')).toBe(false);
    expect(isSameSupportedLanguage('en', 'fr')).toBe(false);
  });
});
