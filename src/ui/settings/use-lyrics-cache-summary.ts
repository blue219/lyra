import { useCallback, useEffect, useState } from 'react';

import { getExtensionApi } from '@/src/adapters/chrome/extension-api';
import type { CacheSummary } from '@/src/domain/model';
import {
  clearLyricsCache,
  getLyricsCacheSummary,
} from '@/src/adapters/chrome/runtime-client';

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
  const [cacheSummary, setCacheSummary] =
    useState<CacheSummary>(emptyCacheSummary);
  const [isCachePending, setIsCachePending] = useState(refreshOnMount);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);

  const refreshCacheSummary = useCallback(async (): Promise<void> => {
    setIsCachePending(true);
    setCacheError(null);

    try {
      setCacheSummary(await getLyricsCacheSummary(extensionApi));
    } catch {
      setCacheError('Cache status is unavailable. Try again.');
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
    setCacheError(null);
    void getLyricsCacheSummary(extensionApi)
      .then((summary) => {
        if (!isCancelled) {
          setCacheSummary(summary);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCacheError('Cache status is unavailable. Try again.');
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
    setCacheError(null);

    try {
      await clearLyricsCache(extensionApi);
      await refreshCacheSummary();
    } catch {
      setCacheError('Cache could not be cleared. Try again.');
    } finally {
      setIsClearingCache(false);
    }
  }, [extensionApi, refreshCacheSummary]);

  return {
    cacheSummary,
    isCachePending,
    isClearingCache,
    cacheError,
    refreshCacheSummary,
    clearCache,
  };
}
