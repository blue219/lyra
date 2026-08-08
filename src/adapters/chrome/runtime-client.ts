import { getExtensionApi } from './extension-api';
import {
  createRuntimeClient,
  type FetchLyricsRequest,
  type TranslateLyricsRequest,
} from '@/src/ports/runtime';
import type { CacheSummary, LyricsResult } from '@/src/domain/model';

type ExtensionApi = ReturnType<typeof getExtensionApi>;

function getClient(extensionApi: ExtensionApi = getExtensionApi()) {
  const runtime = extensionApi?.runtime;

  if (!runtime) {
    throw new Error('Extension runtime is unavailable');
  }

  return createRuntimeClient(runtime);
}

export function requestLyrics(
  request: Omit<FetchLyricsRequest, 'type'>,
): Promise<LyricsResult> {
  return getClient().send<'lyra:fetchLyrics'>({
    type: 'lyra:fetchLyrics',
    ...request,
  });
}

export function requestTranslatedLyrics(
  request: Omit<TranslateLyricsRequest, 'type'>,
): Promise<LyricsResult> {
  return getClient().send<'lyra:translateLyrics'>({
    type: 'lyra:translateLyrics',
    ...request,
  });
}

export async function getLyricsCacheSummary(
  extensionApi: ExtensionApi = getExtensionApi(),
): Promise<CacheSummary> {
  return await getClient(extensionApi).send<'lyra:getLyricsCacheSummary'>({
    type: 'lyra:getLyricsCacheSummary',
  });
}

export async function clearLyricsCache(
  extensionApi: ExtensionApi = getExtensionApi(),
): Promise<void> {
  await getClient(extensionApi).send<'lyra:clearLyricsCache'>({
    type: 'lyra:clearLyricsCache',
  });
}
