import { useEffect, useState } from 'react';

import { defaultOverlaySettings, sanitizeOverlaySettings } from '../settings/settings';
import { SettingsPanel } from '../settings/settings-panel';
import {
  loadOverlaySettings,
  saveOverlaySettings,
} from '../settings/settings-storage';
import { getExtensionApi } from '../../shared/extension-api';
import type { OverlaySettings } from '../../shared/types';

interface PopupAppProps {
  extensionApi?: ReturnType<typeof getExtensionApi>;
}

export function PopupApp({ extensionApi = getExtensionApi() }: PopupAppProps) {
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);

  useEffect(() => {
    let isCancelled = false;

    void loadOverlaySettings(extensionApi).then((nextSettings) => {
      if (!isCancelled) {
        setSettings(nextSettings);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [extensionApi]);

  function updateSettings(patch: Partial<OverlaySettings>) {
    setSettings((currentSettings) => {
      const nextSettings = sanitizeOverlaySettings({
        ...currentSettings,
        ...patch,
      });

      void saveOverlaySettings(extensionApi, nextSettings);

      return nextSettings;
    });
  }

  return (
    <main className="w-[274px] bg-[rgba(24,24,24,0.96)] text-[var(--lyra-color-text)]">
      <SettingsPanel
        footerText="Lyra lyrics are synced with playback."
        settings={settings}
        onSettingsChange={updateSettings}
        variant="popup"
      />
    </main>
  );
}
