import { afterEach, describe, expect, test, vi } from 'vitest';

import { translateGoogleLineChunk } from './google-provider';
import { createJsonResponse } from '@/src/testing/test-utils';

afterEach(() => vi.unstubAllGlobals());

describe('Google translation adapter', () => {
  test('omits credentials and preserves line boundaries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createJsonResponse([[['Bonjour', 'Hello']], null, 'en']),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await translateGoogleLineChunk(
      [{ timeMs: 0, original: 'Hello' }],
      'fr-FR',
      new AbortController().signal,
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'omit',
      signal: expect.any(AbortSignal),
    });
    expect(result).toMatchObject({
      status: 'translated',
      lines: [{ translated: 'Bonjour', translatedLanguage: 'fr-FR' }],
    });
  });
});
