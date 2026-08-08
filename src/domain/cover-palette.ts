export type CoverPalette = [string, string, string];

export const fixedCoverPalette: CoverPalette = [
  '#7cff67',
  '#b497cf',
  '#5227ff',
];

const minimumAlpha = 128;
const minimumSaturation = 0.25;
const minimumLightness = 0.12;
const maximumLightness = 0.82;
const hueBucketCount = 12;

interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
}

interface HueBucket {
  blue: number;
  green: number;
  red: number;
  weight: number;
}

export function deriveCoverPalette(
  pixels: Uint8ClampedArray,
): CoverPalette | null {
  const buckets = Array.from({ length: hueBucketCount }, () => ({
    red: 0,
    green: 0,
    blue: 0,
    weight: 0,
  }));

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const alpha = pixels[index + 3] ?? 0;
    const hsl = rgbToHsl(red, green, blue);

    if (
      alpha < minimumAlpha ||
      hsl.saturation < minimumSaturation ||
      hsl.lightness < minimumLightness ||
      hsl.lightness > maximumLightness
    ) {
      continue;
    }

    const weight =
      (alpha / 255) *
      hsl.saturation *
      (1 - Math.min(Math.abs(hsl.lightness - 0.5) * 1.6, 0.8));
    const bucket =
      buckets[
        Math.min(
          Math.floor(hsl.hue / (360 / hueBucketCount)),
          hueBucketCount - 1,
        )
      ];

    if (!bucket) continue;
    bucket.red += red * weight;
    bucket.green += green * weight;
    bucket.blue += blue * weight;
    bucket.weight += weight;
  }

  const dominant = buckets.reduce<HueBucket | null>((best, bucket) => {
    return bucket.weight > (best?.weight ?? 0) ? bucket : best;
  }, null);

  if (!dominant || dominant.weight === 0) {
    return null;
  }

  const base = rgbToHsl(
    dominant.red / dominant.weight,
    dominant.green / dominant.weight,
    dominant.blue / dominant.weight,
  );
  const saturation = clamp(base.saturation, 0.58, 0.76);

  return [
    hslToHex({
      hue: base.hue,
      saturation: Math.min(saturation, 0.64),
      lightness: 0.55,
    }),
    hslToHex({ hue: base.hue, saturation, lightness: 0.38 }),
    hslToHex({ hue: base.hue, saturation, lightness: 0.24 }),
  ];
}

function rgbToHsl(red: number, green: number, blue: number): HslColor {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const maximum = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const minimum = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const lightness = (maximum + minimum) / 2;
  const delta = maximum - minimum;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;

  if (maximum === normalizedRed) {
    hue = 60 * (((normalizedGreen - normalizedBlue) / delta) % 6);
  } else if (maximum === normalizedGreen) {
    hue = 60 * ((normalizedBlue - normalizedRed) / delta + 2);
  } else {
    hue = 60 * ((normalizedRed - normalizedGreen) / delta + 4);
  }

  return { hue: (hue + 360) % 360, saturation, lightness };
}

function hslToHex({ hue, saturation, lightness }: HslColor): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = lightness - chroma / 2;
  const [red, green, blue] =
    segment < 1
      ? [chroma, secondary, 0]
      : segment < 2
        ? [secondary, chroma, 0]
        : segment < 3
          ? [0, chroma, secondary]
          : segment < 4
            ? [0, secondary, chroma]
            : segment < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];

  return `#${[red, green, blue]
    .map((value) =>
      Math.round((value + match) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
