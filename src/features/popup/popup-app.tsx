import { useState } from 'react';

import { useLyricsCacheSummary } from '../lyrics/use-lyrics-cache-summary';
import { SettingsPanel } from '../settings/settings-panel';
import { useOverlaySettings } from '../settings/use-overlay-settings';
import { getExtensionApi } from '../../shared/extension-api';

interface PopupAppProps {
  extensionApi?: ReturnType<typeof getExtensionApi>;
}

export function PopupApp({ extensionApi = getExtensionApi() }: PopupAppProps) {
  const [stableExtensionApi] = useState(() => extensionApi);
  const { settings, updateSettings } = useOverlaySettings(stableExtensionApi);
  const {
    cacheSummary,
    isCachePending,
    isClearingCache,
    clearCache,
  } = useLyricsCacheSummary({
    extensionApi: stableExtensionApi,
    refreshOnMount: true,
  });

  return (
    <main className="w-[274px] bg-[rgba(24,24,24,0.96)] text-[var(--lyra-color-text)]">
      <SettingsPanel
        cacheSummary={cacheSummary}
        footerText="Lyra lyrics are synced with playback."
        isCachePending={isCachePending}
        isClearingCache={isClearingCache}
        settings={settings}
        onClearCache={clearCache}
        onSettingsChange={updateSettings}
        variant="popup"
      />
    </main>
  );
}
