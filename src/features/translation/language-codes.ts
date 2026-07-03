import {
  findSupportedLanguage,
  supportedLanguages,
} from '../../shared/supported-languages';

export function toGoogleTranslateLanguage(language: string | undefined): string | null {
  return findSupportedLanguage(language)?.googleCode ?? null;
}

export function toMicrosoftTranslateLanguage(language: string | undefined): string | null {
  return findSupportedLanguage(language)?.microsoftCode ?? null;
}

export function fromGoogleTranslateLanguage(language: string): string | undefined {
  return supportedLanguages.find(
    (supportedLanguage) =>
      supportedLanguage.value === language ||
      supportedLanguage.googleCode === language ||
      supportedLanguage.aliases?.includes(language),
  )?.value;
}

export function fromMicrosoftTranslateLanguage(language: string): string | undefined {
  return supportedLanguages.find(
    (supportedLanguage) =>
      supportedLanguage.value === language ||
      supportedLanguage.microsoftCode === language ||
      supportedLanguage.aliases?.includes(language),
  )?.value;
}
