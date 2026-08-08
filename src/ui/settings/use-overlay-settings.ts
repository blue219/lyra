import { useCallback, useEffect, useState } from 'react';

import { getExtensionApi } from '@/src/adapters/chrome/extension-api';
import type { OverlaySettings } from '@/src/domain/model';
import {
  defaultOverlaySettings,
  sanitizeOverlaySettings,
} from '@/src/domain/settings';
import {
  loadOverlaySettings,
  saveOverlaySettings,
  subscribeOverlaySettings,
} from '@/src/adapters/chrome/settings-storage';

type ExtensionApi = ReturnType<typeof getExtensionApi>;

export function useOverlaySettings(
  extensionApi: ExtensionApi = getExtensionApi(),
) {
  const [settings, setSettings] = useState<OverlaySettings>(
    defaultOverlaySettings,
  );
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const reloadSettings = useCallback(async () => {
    try {
      const nextSettings = await loadOverlaySettings(extensionApi);
      setSettings(nextSettings);
      setSettingsError(null);
    } catch {
      setSettingsError('Settings could not be loaded. Try again.');
    } finally {
      setIsSettingsLoaded(true);
    }
  }, [extensionApi]);

  useEffect(() => {
    let isCancelled = false;

    setSettingsError(null);
    loadOverlaySettings(extensionApi)
      .then((nextSettings) => {
        if (isCancelled) {
          return;
        }

        setSettings(nextSettings);
        setIsSettingsLoaded(true);
      })
      .catch(() => {
        if (!isCancelled) {
          setSettings(defaultOverlaySettings);
          setIsSettingsLoaded(true);
          setSettingsError('Settings could not be loaded. Try again.');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [extensionApi]);

  useEffect(() => {
    return subscribeOverlaySettings(extensionApi, (nextSettings) => {
      setSettings(nextSettings);
      setIsSettingsLoaded(true);
    });
  }, [extensionApi]);

  const updateSettings = useCallback(
    (patch: Partial<OverlaySettings>) => {
      setSettings((currentSettings) => {
        const nextSettings = sanitizeOverlaySettings({
          ...currentSettings,
          ...patch,
        });

        setSettingsError(null);
        void saveOverlaySettings(extensionApi, nextSettings).catch(async () => {
          setSettingsError(
            'Settings could not be saved. Your change was reverted.',
          );
          try {
            setSettings(await loadOverlaySettings(extensionApi));
          } catch {
            setSettings(defaultOverlaySettings);
          }
        });

        return nextSettings;
      });
    },
    [extensionApi],
  );

  return {
    settings,
    isSettingsLoaded,
    settingsError,
    reloadSettings,
    updateSettings,
  };
}
