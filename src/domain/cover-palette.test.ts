import { describe, expect, test } from 'vitest';

import { deriveCoverPalette, fixedCoverPalette } from './cover-palette';

describe('deriveCoverPalette', () => {
  test('derives a readable three-step palette from a vivid dominant hue', () => {
    const pixels = new Uint8ClampedArray([
      224, 48, 96, 255, 216, 40, 88, 255, 208, 32, 80, 255, 20, 20, 20, 255,
    ]);

    expect(deriveCoverPalette(pixels)).toEqual([
      '#d6436b',
      '#a41e42',
      '#68132a',
    ]);
  });

  test('returns no palette for transparent, grayscale, and near-black pixels', () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 0, 128, 128, 128, 255, 12, 12, 12, 255, 250, 250, 250, 255,
    ]);

    expect(deriveCoverPalette(pixels)).toBeNull();
  });

  test('supports green and blue dominant hues', () => {
    expect(
      deriveCoverPalette(new Uint8ClampedArray([40, 216, 88, 255])),
    ).toEqual(['#43d66b', '#1ea442', '#13682a']);
    expect(
      deriveCoverPalette(new Uint8ClampedArray([40, 88, 216, 255])),
    ).toEqual(['#436bd6', '#1e42a4', '#132a68']);
  });
});

describe('fixedCoverPalette', () => {
  test('keeps the existing Lyra aurora colors as the safe fallback', () => {
    expect(fixedCoverPalette).toEqual(['#7cff67', '#b497cf', '#5227ff']);
  });
});
