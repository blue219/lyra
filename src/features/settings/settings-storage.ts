import { getExtensionApi } from '../../shared/extension-api';
import type { OverlaySettings } from '../../shared/types';
import { defaultOverlaySettings, sanitizeOverlaySettings } from './settings';

export const overlaySettingsStorageKey = 'overlaySettings';

type ExtensionApi = ReturnType<typeof getExtensionApi>;

export async function loadOverlaySettings(extensionApi: ExtensionApi): Promise<OverlaySettings> {
  if (!extensionApi?.storage?.local) {
    return defaultOverlaySettings;
  }

  try {
    const storedValue = await extensionApi.storage.local.get(overlaySettingsStorageKey);
    return sanitizeOverlaySettings(
      storedValue[overlaySettingsStorageKey] as Partial<OverlaySettings> | undefined,
    );
  } catch {
    return defaultOverlaySettings;
  }
}

export async function saveOverlaySettings(
  extensionApi: ExtensionApi,
  settings: OverlaySettings,
): Promise<void> {
  if (!extensionApi?.storage?.local) {
    return;
  }

  await extensionApi.storage.local.set({
    [overlaySettingsStorageKey]: sanitizeOverlaySettings(settings),
  });
}
