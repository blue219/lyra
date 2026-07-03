import { useCallback, useEffect, useState } from 'react';

import { getExtensionApi } from '../../shared/extension-api';
import type { CacheSummary } from '../../shared/types';
import {
  clearLyricsCache,
  getLyricsCacheSummary,
} from './messages';

type ExtensionApi = ReturnType<typeof getExtensionApi>;

const emptyCacheSummary: CacheSummary = {
  songCount: 0,
  entryCount: 0,
  maxEntries: 0,
  sizeBytes: 0,
};

export function useLyricsCacheSummary({
  extensionApi = getExtensionApi(),
  refreshOnMount = false,
}: {
  extensionApi?: ExtensionApi;
  refreshOnMount?: boolean;
} = {}) {
  const [cacheSummary, setCacheSummary] = useState<CacheSummary>(emptyCacheSummary);
  const [isCachePending, setIsCachePending] = useState(refreshOnMount);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const refreshCacheSummary = useCallback(async (): Promise<void> => {
    setIsCachePending(true);

    try {
      setCacheSummary(await getLyricsCacheSummary(extensionApi));
    } finally {
      setIsCachePending(false);
    }
  }, [extensionApi]);

  useEffect(() => {
    if (!refreshOnMount) {
      return;
    }

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
  }, [extensionApi, refreshOnMount]);

  const clearCache = useCallback(async (): Promise<void> => {
    setIsClearingCache(true);

    try {
      await clearLyricsCache(extensionApi);
      await refreshCacheSummary();
    } finally {
      setIsClearingCache(false);
    }
  }, [extensionApi, refreshCacheSummary]);

  return {
    cacheSummary,
    isCachePending,
    isClearingCache,
    refreshCacheSummary,
    clearCache,
  };
}
