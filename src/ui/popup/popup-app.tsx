import { useState } from 'react';

import { useLyricsCacheSummary } from '@/src/ui/settings/use-lyrics-cache-summary';
import { SettingsPanel } from '@/src/ui/settings/settings-panel';
import { useOverlaySettings } from '@/src/ui/settings/use-overlay-settings';
import { getExtensionApi } from '@/src/adapters/chrome/extension-api';

interface PopupAppProps {
  extensionApi?: ReturnType<typeof getExtensionApi>;
}

export function PopupApp({ extensionApi = getExtensionApi() }: PopupAppProps) {
  const [stableExtensionApi] = useState(() => extensionApi);
  const { settings, updateSettings, settingsError, reloadSettings } =
    useOverlaySettings(stableExtensionApi);
  const {
    cacheSummary,
    isCachePending,
    isClearingCache,
    clearCache,
    cacheError,
    refreshCacheSummary,
  } = useLyricsCacheSummary({
    extensionApi: stableExtensionApi,
    refreshOnMount: true,
  });

  return (
    <main className="w-[274px] bg-[rgba(24,24,24,0.96)] text-[var(--lyra-color-text)]">
      <SettingsPanel
        cacheSummary={cacheSummary}
        isCachePending={isCachePending}
        isClearingCache={isClearingCache}
        settings={settings}
        onClearCache={clearCache}
        onSettingsChange={updateSettings}
        errorMessage={settingsError ?? cacheError}
        onRetry={() => {
          void reloadSettings();
          void refreshCacheSummary();
        }}
        variant="popup"
      />
    </main>
  );
}
