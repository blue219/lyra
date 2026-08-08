import {
  findSupportedLanguage,
  supportedLanguages,
} from '@/src/domain/languages';

export function toGoogleTranslateLanguage(
  language: string | undefined,
): string | null {
  return findSupportedLanguage(language)?.googleCode ?? null;
}

export function fromGoogleTranslateLanguage(
  language: string,
): string | undefined {
  return supportedLanguages.find(
    (supportedLanguage) =>
      supportedLanguage.value === language ||
      supportedLanguage.googleCode === language ||
      supportedLanguage.aliases?.includes(language),
  )?.value;
}
