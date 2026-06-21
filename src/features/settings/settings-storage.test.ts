import { describe, expect, test, vi } from 'vitest';

import { defaultOverlaySettings } from './settings';
import {
  loadOverlaySettings,
  overlaySettingsStorageKey,
  saveOverlaySettings,
  subscribeOverlaySettings,
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

describe('subscribeOverlaySettings', () => {
  test('subscribes to local storage changes and emits sanitized overlay settings', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const callback = vi.fn();

    const unsubscribe = subscribeOverlaySettings(
      {
        storage: {
          onChanged: {
            addListener,
            removeListener,
          },
        },
      } as never,
      callback,
    );

    expect(addListener).toHaveBeenCalledTimes(1);
    const listener = addListener.mock.calls[0]?.[0] as
      | ((changes: Record<string, { newValue?: unknown }>, areaName: string) => void)
      | undefined;

    listener?.(
      {
        [overlaySettingsStorageKey]: {
          newValue: {
            targetLanguage: 'zh-CN',
            fontSize: 'lg',
            dynamicBackground: false,
          },
        },
      },
      'local',
    );

    expect(callback).toHaveBeenCalledWith({
      targetLanguage: 'zh-CN',
      fontSize: 'lg',
      dynamicBackground: false,
    });

    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });
});
