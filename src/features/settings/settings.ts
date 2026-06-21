import type { OverlaySettings } from '../../shared/types';
import { supportedLanguages } from '../../shared/supported-languages';

const fontSizes = new Set<OverlaySettings['fontSize']>(['sm', 'md', 'lg']);
const targetLanguages = new Set(supportedLanguages.map((language) => language.value));

export const defaultOverlaySettings: OverlaySettings = {
  targetLanguage: 'en-US',
  fontSize: 'md',
  dynamicBackground: true,
};

export function sanitizeOverlaySettings(value: unknown): OverlaySettings {
  const candidate =
    value && typeof value === 'object'
      ? (value as Partial<Record<keyof OverlaySettings, unknown>>)
      : {};
  const candidateTargetLanguage =
    typeof candidate.targetLanguage === 'string'
      ? candidate.targetLanguage.trim()
      : '';
  const targetLanguage = targetLanguages.has(candidateTargetLanguage)
    ? candidateTargetLanguage
    : defaultOverlaySettings.targetLanguage;
  const fontSize = fontSizes.has(candidate.fontSize as OverlaySettings['fontSize'])
    ? (candidate.fontSize as OverlaySettings['fontSize'])
    : defaultOverlaySettings.fontSize;
  const dynamicBackground =
    typeof candidate.dynamicBackground === 'boolean'
      ? candidate.dynamicBackground
      : defaultOverlaySettings.dynamicBackground;

  return {
    targetLanguage,
    fontSize,
    dynamicBackground,
  };
}
