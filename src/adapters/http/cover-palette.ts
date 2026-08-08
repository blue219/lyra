import {
  deriveCoverPalette,
  type CoverPalette,
} from '@/src/domain/cover-palette';

const supportedCoverImageHost = 'i.scdn.co';
const coverFetchTimeoutMs = 8_000;
const maximumCoverImageBytes = 2 * 1024 * 1024;
const sampleSize = 32;

type FetchImage = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type DecodePixels = (image: Blob) => Promise<Uint8ClampedArray | null>;

interface CoverPaletteResolverOptions {
  decodePixels?: DecodePixels;
  fetchImage?: FetchImage;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}

export function isSupportedCoverImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' && url.hostname === supportedCoverImageHost
    );
  } catch {
    return false;
  }
}

export function createCoverPaletteResolver(
  options: CoverPaletteResolverOptions = {},
) {
  const fetchImage = options.fetchImage ?? fetch;
  const decodePixels = options.decodePixels ?? decodeCoverPixels;
  const setTimeoutFn = options.setTimeout ?? globalThis.setTimeout;
  const clearTimeoutFn = options.clearTimeout ?? globalThis.clearTimeout;
  const cache = new Map<string, Promise<CoverPalette | null>>();

  return {
    resolve(url: string): Promise<CoverPalette | null> {
      if (!isSupportedCoverImageUrl(url)) {
        return Promise.resolve(null);
      }

      const existing = cache.get(url);
      if (existing) return existing;

      const result = fetchAndDerivePalette({
        url,
        fetchImage,
        decodePixels,
        setTimeoutFn,
        clearTimeoutFn,
      });
      cache.set(url, result);
      return result;
    },
  };
}

async function fetchAndDerivePalette({
  url,
  fetchImage,
  decodePixels,
  setTimeoutFn,
  clearTimeoutFn,
}: {
  url: string;
  fetchImage: FetchImage;
  decodePixels: DecodePixels;
  setTimeoutFn: typeof globalThis.setTimeout;
  clearTimeoutFn: typeof globalThis.clearTimeout;
}): Promise<CoverPalette | null> {
  const controller = new AbortController();
  const timeout = setTimeoutFn(() => controller.abort(), coverFetchTimeoutMs);

  try {
    const response = await fetchImage(url, {
      credentials: 'omit',
      signal: controller.signal,
    });
    const declaredLength = Number(response.headers.get('content-length'));

    if (
      !response.ok ||
      !response.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('image/') ||
      (Number.isFinite(declaredLength) &&
        declaredLength > maximumCoverImageBytes)
    ) {
      return null;
    }

    const image = await response.blob();
    if (image.size > maximumCoverImageBytes) return null;

    const pixels = await decodePixels(image);
    return pixels ? deriveCoverPalette(pixels) : null;
  } catch {
    return null;
  } finally {
    clearTimeoutFn(timeout);
  }
}

async function decodeCoverPixels(
  image: Blob,
): Promise<Uint8ClampedArray | null> {
  if (
    typeof createImageBitmap !== 'function' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return null;
  }

  const bitmap = await createImageBitmap(image);

  try {
    const canvas = new OffscreenCanvas(sampleSize, sampleSize);
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) return null;
    context.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
    return context.getImageData(0, 0, sampleSize, sampleSize).data;
  } finally {
    bitmap.close();
  }
}
