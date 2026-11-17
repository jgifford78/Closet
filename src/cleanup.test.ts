import { describe, expect, it } from 'vitest';
import { keepMainObject } from './cleanup';

function image(w: number, h: number, rects: Array<[number, number, number, number]>) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (const [x0, y0, x1, y1] of rects)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) d.set([10, 20, 30, 255], (y * w + x) * 4);
  return d;
}
const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe('keepMainObject', () => {
  it('removes small detached clutter and returns the main bbox', () => {
    const w = 40, h = 40;
    const d = image(w, h, [[5, 5, 25, 30], [32, 2, 35, 4]]); // big item + tiny "text"
    const box = keepMainObject(d, w, h);
    expect(box).toEqual({ x: 5, y: 5, w: 20, h: 25 });
    expect(alphaAt(d, w, 10, 10)).toBe(255);
    expect(alphaAt(d, w, 33, 3)).toBe(0);
  });
  it('keeps a comparable second piece (e.g. pair of shoes)', () => {
    const w = 40, h = 20;
    const d = image(w, h, [[2, 2, 14, 18], [24, 2, 36, 18]]);
    const box = keepMainObject(d, w, h);
    expect(box).toEqual({ x: 2, y: 2, w: 34, h: 16 });
    expect(alphaAt(d, w, 30, 10)).toBe(255);
  });
  it('returns null for a fully transparent image', () => {
    expect(keepMainObject(new Uint8ClampedArray(16 * 4), 4, 4)).toBeNull();
  });
});
