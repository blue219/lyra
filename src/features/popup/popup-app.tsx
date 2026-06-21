import { useEffect, useState } from 'react';

import {
  clearLyricsCache,
  getLyricsCacheSummary,
} from '../lyrics/messages';
import { defaultOverlaySettings, sanitizeOverlaySettings } from '../settings/settings';
import { SettingsPanel } from '../settings/settings-panel';
import {
  loadOverlaySettings,
  saveOverlaySettings,
  subscribeOverlaySettings,
} from '../settings/settings-storage';
import { getExtensionApi } from '../../shared/extension-api';
import type { CacheSummary, OverlaySettings } from '../../shared/types';

interface PopupAppProps {
  extensionApi?: ReturnType<typeof getExtensionApi>;
}

export function PopupApp({ extensionApi = getExtensionApi() }: PopupAppProps) {
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [cacheSummary, setCacheSummary] = useState<CacheSummary>({
    songCount: 0,
    entryCount: 0,
    maxEntries: 0,
    sizeBytes: 0,
  });
  const [isCachePending, setIsCachePending] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);

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

  useEffect(() => {
    return subscribeOverlaySettings(extensionApi, (nextSettings) => {
      setSettings(nextSettings);
    });
  }, [extensionApi]);

  useEffect(() => {
    let isCancelled = false;

    setIsCachePending(true);
    void getLyricsCacheSummary(extensionApi)
      .then((summary) => {
        if (!isCancelled) {
          setCacheSummary(summary);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsCachePending(false);
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

  async function handleClearCache() {
    setIsClearingCache(true);

    try {
      await clearLyricsCache(extensionApi);
      setCacheSummary(await getLyricsCacheSummary(extensionApi));
    } finally {
      setIsClearingCache(false);
    }
  }

  return (
    <main className="w-[274px] bg-[rgba(24,24,24,0.96)] text-[var(--lyra-color-text)]">
      <SettingsPanel
        cacheSummary={cacheSummary}
        footerText="Lyra lyrics are synced with playback."
        isCachePending={isCachePending}
        isClearingCache={isClearingCache}
        settings={settings}
        onClearCache={handleClearCache}
        onSettingsChange={updateSettings}
        variant="popup"
      />
    </main>
  );
}
