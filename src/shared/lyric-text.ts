export function isSameLyricText(left: string, right: string): boolean {
  return normalizeComparableLyricText(left) === normalizeComparableLyricText(right);
}

function normalizeComparableLyricText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
