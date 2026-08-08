export interface SupportedLanguage {
  value: string;
  label: string;
  googleCode: string;
  aliases?: string[];
}

export const supportedLanguages: SupportedLanguage[] = [
  {
    value: 'en-US',
    label: 'English',
    googleCode: 'en',
    aliases: ['en'],
  },
  {
    value: 'zh-CN',
    label: 'Chinese (Simplified)',
    googleCode: 'zh-CN',
    aliases: ['zh', 'zh-Hans'],
  },
  {
    value: 'zh-TW',
    label: 'Chinese (Traditional)',
    googleCode: 'zh-TW',
    aliases: ['zh-Hant'],
  },
  {
    value: 'ja-JP',
    label: 'Japanese',
    googleCode: 'ja',
    aliases: ['ja'],
  },
  {
    value: 'ko-KR',
    label: 'Korean',
    googleCode: 'ko',
    aliases: ['ko'],
  },
  {
    value: 'es-ES',
    label: 'Spanish',
    googleCode: 'es',
    aliases: ['es'],
  },
  {
    value: 'fr-FR',
    label: 'French',
    googleCode: 'fr',
    aliases: ['fr'],
  },
  {
    value: 'de-DE',
    label: 'German',
    googleCode: 'de',
    aliases: ['de'],
  },
  {
    value: 'pt-BR',
    label: 'Portuguese',
    googleCode: 'pt',
    aliases: ['pt', 'pt-PT'],
  },
  {
    value: 'it-IT',
    label: 'Italian',
    googleCode: 'it',
    aliases: ['it'],
  },
  {
    value: 'ru-RU',
    label: 'Russian',
    googleCode: 'ru',
    aliases: ['ru'],
  },
  {
    value: 'id-ID',
    label: 'Indonesian',
    googleCode: 'id',
    aliases: ['id'],
  },
];

export function findSupportedLanguage(
  language: string | undefined,
): SupportedLanguage | undefined {
  if (!language) {
    return undefined;
  }

  return supportedLanguages.find(
    (supportedLanguage) =>
      supportedLanguage.value === language ||
      supportedLanguage.googleCode === language ||
      supportedLanguage.aliases?.includes(language),
  );
}

export function isSameSupportedLanguage(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  const leftLanguage = findSupportedLanguage(left);
  const rightLanguage = findSupportedLanguage(right);

  return Boolean(
    leftLanguage && rightLanguage && leftLanguage.value === rightLanguage.value,
  );
}
