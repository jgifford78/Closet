import { describe, expect, it } from 'vitest';
import { PROMPTS, defaultName, defaultSeasons, pickCategory } from './classify';

const score = (m: Record<string, number>) => PROMPTS.map(([label]) => ({ label, score: m[label] ?? 0 }));

describe('pickCategory', () => {
  it('sums prompts per category', () => {
    const r = pickCategory(score({
      'a photo of pants or jeans': 0.25, 'a photo of shorts': 0.2,
      'a photo of a dress': 0.3
    }));
    expect(r.category).toBe('bottom'); // 0.45 beats dress 0.30
    expect(r.type).toBe('Pants'); // best prompt inside the winning category
  });
  it('returns null when not confident', () => {
    expect(pickCategory(score({ 'a photo of a dress': 0.2 })).category).toBeNull();
  });
  it('ignores unknown labels', () => {
    expect(pickCategory([{ label: 'nope', score: 1 }]).category).toBeNull();
  });
});

describe('defaultSeasons', () => {
  it('only outerwear implies seasons', () => {
    expect(defaultSeasons('outerwear')).toEqual(['fall', 'winter']);
    expect(defaultSeasons('top')).toEqual([]);
    expect(defaultSeasons(null)).toEqual([]);
  });
});

describe('defaultName', () => {
  it('combines main color and type', () => {
    expect(defaultName('bottom', ['navy'], 'Pants')).toBe('Navy Pants');
    expect(defaultName('outerwear', [], null)).toBe('Jacket');
    expect(defaultName('top', ['white'])).toBe('White Top');
    expect(defaultName(null, ['red'])).toBe('New item');
  });
});
