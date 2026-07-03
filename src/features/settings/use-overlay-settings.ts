import { useCallback, useEffect, useState } from 'react';

import { getExtensionApi } from '../../shared/extension-api';
import type { OverlaySettings } from '../../shared/types';
import { defaultOverlaySettings, sanitizeOverlaySettings } from './settings';
import {
  loadOverlaySettings,
  saveOverlaySettings,
  subscribeOverlaySettings,
} from './settings-storage';

type ExtensionApi = ReturnType<typeof getExtensionApi>;

export function useOverlaySettings(extensionApi: ExtensionApi = getExtensionApi()) {
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

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

        void saveOverlaySettings(extensionApi, nextSettings);

        return nextSettings;
      });
    },
    [extensionApi],
  );

  return {
    settings,
    isSettingsLoaded,
    updateSettings,
  };
}
