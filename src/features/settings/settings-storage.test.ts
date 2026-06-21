import { describe, expect, test, vi } from 'vitest';

import { defaultOverlaySettings } from './settings';
import {
  loadOverlaySettings,
  overlaySettingsStorageKey,
  saveOverlaySettings,
} from './settings-storage';

describe('loadOverlaySettings', () => {
  test('returns sanitized stored settings when storage is available', async () => {
    const get = vi.fn().mockResolvedValue({
      [overlaySettingsStorageKey]: {
        targetLanguage: 'zh-CN',
        fontSize: 'lg',
        dynamicBackground: false,
      },
    });

    await expect(
      loadOverlaySettings({
        storage: {
          local: {
            get,
          },
        },
      } as never),
    ).resolves.toEqual({
      targetLanguage: 'zh-CN',
      fontSize: 'lg',
      dynamicBackground: false,
    });
  });

  test('falls back to defaults when storage is unavailable', async () => {
    await expect(loadOverlaySettings(null)).resolves.toEqual(defaultOverlaySettings);
  });
});

describe('saveOverlaySettings', () => {
  test('persists sanitized settings under the shared storage key', async () => {
    const set = vi.fn().mockResolvedValue(undefined);

    await saveOverlaySettings(
      {
        storage: {
          local: {
            set,
          },
        },
      } as never,
      {
        targetLanguage: 'zh-CN',
        fontSize: 'md',
        dynamicBackground: false,
      },
    );

    expect(set).toHaveBeenCalledWith({
      [overlaySettingsStorageKey]: {
        targetLanguage: 'zh-CN',
        fontSize: 'md',
        dynamicBackground: false,
      },
    });
  });
});
