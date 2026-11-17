import { describe, expect, it } from 'vitest';
import { classifyColor, dominantColors } from './colors';

const px = (r: number, g: number, b: number, a = 255, n = 1) =>
  Array.from({ length: n }, () => [r, g, b, a]).flat();

describe('classifyColor', () => {
  it.each([
    [0, 0, 0, 'black'], [255, 255, 255, 'white'], [128, 128, 128, 'gray'],
    [220, 30, 30, 'red'], [30, 60, 160, 'blue'], [20, 30, 90, 'navy'],
    [30, 150, 70, 'green'], [250, 200, 20, 'yellow'], [120, 75, 45, 'brown'],
    [214, 195, 161, 'beige'], [236, 72, 153, 'pink'], [147, 51, 234, 'purple']
  ])('rgb(%i,%i,%i) -> %s', (r, g, b, name) => {
    expect(classifyColor(r, g, b)).toBe(name);
  });
});

describe('dominantColors', () => {
  it('ignores transparent pixels and orders by share', () => {
    const data = new Uint8ClampedArray([
      ...px(0, 0, 0, 0, 100), // transparent -> ignored
      ...px(30, 60, 160, 255, 70),
      ...px(255, 255, 255, 255, 30)
    ]);
    expect(dominantColors(data)).toEqual(['blue', 'white']);
  });
  it('drops minor secondary colors', () => {
    const data = new Uint8ClampedArray([...px(30, 60, 160, 255, 95), ...px(220, 30, 30, 255, 5)]);
    expect(dominantColors(data)).toEqual(['blue']);
  });
  it('returns [] for fully transparent input', () => {
    expect(dominantColors(new Uint8ClampedArray(px(1, 2, 3, 0, 10)))).toEqual([]);
  });
});
