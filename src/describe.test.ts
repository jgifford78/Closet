import { describe, expect, it } from 'vitest';
import { buildDescription } from './describe';

describe('buildDescription', () => {
  it('fills gaps from detection', () => {
    expect(buildDescription({ category: null, colors: [] }, ['navy'], { category: 'bottom', type: 'Pants' }))
      .toEqual({ category: 'bottom', colors: ['navy'], name: 'Navy Pants' });
  });
  it('keeps user category and colors', () => {
    expect(buildDescription({ category: 'top', colors: ['red'] }, ['blue'], { category: 'bottom', type: 'Pants' }))
      .toEqual({ category: 'top', colors: ['red'], name: 'Red Top' }); // type ignored: detection disagrees
  });
  it('uses specific type when detection agrees with user category', () => {
    expect(buildDescription({ category: 'outerwear', colors: ['black'] }, [], { category: 'outerwear', type: 'Blazer' }).name)
      .toBe('Black Blazer');
  });
  it('falls back when detection failed', () => {
    expect(buildDescription({ category: null, colors: [] }, ['white'], null).name).toBe('New item');
  });
});
