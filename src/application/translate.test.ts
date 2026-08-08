import { describe, expect, test, vi } from 'vitest';

import type { LyricsResult } from '@/src/domain/model';
import { createTranslationOrchestrator } from './translate';

const original: LyricsResult = {
  status: 'available',
  source: 'spotify',
  lines: [{ timeMs: 0, original: 'Hello' }],
};

describe('translation orchestrator', () => {
  test('returns unavailable and untargeted results without providers', async () => {
    const translate = createTranslationOrchestrator([]);
    const unavailable: LyricsResult = {
      status: 'unavailable',
      reason: 'not-found',
      lines: [],
    };
    await expect(
      translate(unavailable, 'fr-FR', new AbortController().signal),
    ).resolves.toBe(unavailable);
    await expect(
      translate(original, undefined, new AbortController().signal),
    ).resolves.toBe(original);
  });

  test('removes stale translations when source and target languages match', async () => {
    const translate = createTranslationOrchestrator([]);
    await expect(
      translate(
        {
          ...original,
          sourceLanguage: 'en',
          lines: [{ ...original.lines[0]!, translated: 'Old' }],
        },
        'en-US',
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      ...original,
      sourceLanguage: 'en',
      degradationReason: 'same-language',
    });
  });
  test('keeps originals and exposes provider degradation', async () => {
    const translate = createTranslationOrchestrator([
      vi.fn().mockResolvedValue({ status: 'provider-error' }),
    ]);
    await expect(
      translate(original, 'fr-FR', new AbortController().signal),
    ).resolves.toEqual({ ...original, degradationReason: 'provider-error' });
  });

  test('publishes translated lines through the same available result', async () => {
    const translate = createTranslationOrchestrator([
      vi.fn().mockResolvedValue({
        status: 'translated',
        sourceLanguage: 'en-US',
        lines: [
          {
            timeMs: 0,
            original: 'Hello',
            translated: 'Bonjour',
            translatedLanguage: 'fr-FR',
          },
        ],
      }),
    ]);
    const result = await translate(
      original,
      'fr-FR',
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      status: 'available',
      sourceLanguage: 'en-US',
      lines: [{ translated: 'Bonjour' }],
    });
  });

  test('cancellation is propagated instead of becoming degradation', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('track changed', 'AbortError'));
    const translate = createTranslationOrchestrator([vi.fn()]);
    await expect(
      translate(original, 'fr-FR', controller.signal),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  test('retries only failed chunks with the next provider', async () => {
    const veryLong = { timeMs: 1, original: 'x'.repeat(1_801) };
    const first = vi.fn().mockResolvedValue({ status: 'network-error' });
    const second = vi.fn().mockResolvedValue({
      status: 'translated',
      sourceLanguage: 'en-US',
      lines: [{ timeMs: 0, original: 'Hello', translated: 'Bonjour' }],
    });
    const translate = createTranslationOrchestrator([first, second]);
    const result = await translate(
      { ...original, lines: [original.lines[0]!, veryLong] },
      'fr-FR',
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      status: 'available',
      sourceLanguage: 'en-US',
      lines: [{ translated: 'Bonjour' }, veryLong],
    });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  test.each([
    ['same-language', 'same-language'],
    ['same-text', 'same-text'],
    ['rate-limited', 'rate-limited'],
  ] as const)(
    'maps provider status %s to degradation %s',
    async (status, expected) => {
      const translate = createTranslationOrchestrator([
        vi.fn().mockResolvedValue({
          status,
          sourceLanguage: 'en-US',
          lines: original.lines,
        }),
      ]);
      await expect(
        translate(original, 'fr-FR', new AbortController().signal),
      ).resolves.toMatchObject({ degradationReason: expected });
    },
  );
});
