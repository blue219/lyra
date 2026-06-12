import type { OverlaySettings } from './types';

const fontSizes = new Set<OverlaySettings['fontSize']>(['sm', 'md', 'lg']);
const targetLanguages = new Set(['en-US', 'zh-CN']);
const positions = new Set<OverlaySettings['position']>([
  'left',
  'right',
  'bottom',
]);

export const defaultOverlaySettings: OverlaySettings = {
  targetLanguage: 'en-US',
  fontSize: 'md',
  position: 'right',
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
  const position = positions.has(candidate.position as OverlaySettings['position'])
    ? (candidate.position as OverlaySettings['position'])
    : defaultOverlaySettings.position;

  return {
    targetLanguage,
    fontSize,
    position,
  };
}
