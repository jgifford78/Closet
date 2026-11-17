export const COLOR_NAMES = [
  'black', 'white', 'gray', 'beige', 'brown', 'red', 'orange',
  'yellow', 'green', 'blue', 'navy', 'purple', 'pink'
] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

/** Approximate display swatch per color name. */
export const COLOR_HEX: Record<ColorName, string> = {
  black: '#1f2937', white: '#f9fafb', gray: '#9ca3af', beige: '#d6c3a1', brown: '#7c4a2d',
  red: '#dc2626', orange: '#f97316', yellow: '#facc15', green: '#16a34a', blue: '#2563eb',
  navy: '#1e3a8a', purple: '#9333ea', pink: '#ec4899'
};

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

export function classifyColor(r: number, g: number, b: number): ColorName {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l < 0.14) return 'black';
  if (l > 0.9 && s < 0.4) return 'white';
  if (s < 0.12) return l > 0.82 ? 'white' : 'gray';
  if (h >= 15 && h < 50 && l < 0.4) return 'brown';
  if (h >= 15 && h < 60 && s < 0.5 && l > 0.6) return 'beige';
  if (h < 15 || h >= 345) return l > 0.75 ? 'pink' : 'red';
  if (h < 40) return 'orange';
  if (h < 65) return 'yellow';
  if (h < 170) return 'green';
  if (h < 255) return l < 0.3 ? 'navy' : 'blue';
  if (h < 300) return 'purple';
  return h >= 320 || l > 0.7 ? 'pink' : 'purple';
}

/**
 * Dominant color names from RGBA pixels, most common first.
 * Transparent pixels are ignored. A secondary color is kept only if it covers >= minShare.
 */
export function dominantColors(rgba: Uint8ClampedArray | Uint8Array, maxColors = 2, minShare = 0.25): ColorName[] {
  const counts = new Map<ColorName, number>();
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 200) continue;
    const name = classifyColor(rgba[i], rgba[i + 1], rgba[i + 2]);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    total++;
  }
  if (!total) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, n], idx) => idx === 0 || n / total >= minShare)
    .slice(0, maxColors)
    .map(([name]) => name);
}
