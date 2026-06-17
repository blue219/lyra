export interface SupportedLanguage {
  value: string;
  label: string;
  googleCode: string;
  microsoftCode: string;
  aliases?: string[];
}

export const supportedLanguages: SupportedLanguage[] = [
  {
    value: 'en-US',
    label: 'English',
    googleCode: 'en',
    microsoftCode: 'en',
    aliases: ['en'],
  },
  {
    value: 'zh-CN',
    label: 'Chinese (Simplified)',
    googleCode: 'zh-CN',
    microsoftCode: 'zh-Hans',
    aliases: ['zh', 'zh-Hans'],
  },
  {
    value: 'zh-TW',
    label: 'Chinese (Traditional)',
    googleCode: 'zh-TW',
    microsoftCode: 'zh-Hant',
    aliases: ['zh-Hant'],
  },
  {
    value: 'ja-JP',
    label: 'Japanese',
    googleCode: 'ja',
    microsoftCode: 'ja',
    aliases: ['ja'],
  },
  {
    value: 'ko-KR',
    label: 'Korean',
    googleCode: 'ko',
    microsoftCode: 'ko',
    aliases: ['ko'],
  },
  {
    value: 'es-ES',
    label: 'Spanish',
    googleCode: 'es',
    microsoftCode: 'es',
    aliases: ['es'],
  },
  {
    value: 'fr-FR',
    label: 'French',
    googleCode: 'fr',
    microsoftCode: 'fr',
    aliases: ['fr'],
  },
  {
    value: 'de-DE',
    label: 'German',
    googleCode: 'de',
    microsoftCode: 'de',
    aliases: ['de'],
  },
  {
    value: 'pt-BR',
    label: 'Portuguese',
    googleCode: 'pt',
    microsoftCode: 'pt',
    aliases: ['pt', 'pt-PT'],
  },
  {
    value: 'it-IT',
    label: 'Italian',
    googleCode: 'it',
    microsoftCode: 'it',
    aliases: ['it'],
  },
  {
    value: 'ru-RU',
    label: 'Russian',
    googleCode: 'ru',
    microsoftCode: 'ru',
    aliases: ['ru'],
  },
  {
    value: 'id-ID',
    label: 'Indonesian',
    googleCode: 'id',
    microsoftCode: 'id',
    aliases: ['id'],
  },
];

export function findSupportedLanguage(language: string | undefined): SupportedLanguage | undefined {
  if (!language) {
    return undefined;
  }

  return supportedLanguages.find(
    (supportedLanguage) =>
      supportedLanguage.value === language ||
      supportedLanguage.aliases?.includes(language),
  );
}
