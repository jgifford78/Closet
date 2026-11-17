import { describe, expect, it } from 'vitest';
import { colorScore, explainEmpty, formalityOk, generateOutfits, pairScore, type Piece } from './outfits';

function rng(seed = 1) { // mulberry32, deterministic
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const p = (id: string, category: Piece['category'], colors: Piece['colors'] = [], extra: Partial<Piece> = {}): Piece =>
  ({ id, category, colors, seasons: [], formality: null, ...extra });

describe('color rules', () => {
  it('neutrals go with anything; clashing brights are penalized', () => {
    expect(pairScore('black', 'red')).toBeGreaterThan(0.9);
    expect(pairScore('red', 'green')).toBe(0.3);
    expect(pairScore('blue', 'orange')).toBe(0.75); // complementary
    expect(pairScore('black', 'brown')).toBeLessThan(0.5);
    expect(pairScore(undefined, 'red')).toBe(0.7);
  });
  it('three bright colors is penalized', () => {
    expect(colorScore(['red', 'yellow', 'blue'])).toBeLessThan(colorScore(['red', 'black', 'white']));
  });
});

describe('formalityOk', () => {
  it('rejects casual + formal, allows adjacent and unknown', () => {
    expect(formalityOk([p('a', 'top', [], { formality: 'casual' }), p('b', 'bottom', [], { formality: 'formal' })])).toBe(false);
    expect(formalityOk([p('a', 'top', [], { formality: 'casual' }), p('b', 'bottom', [], { formality: 'smart' })])).toBe(true);
    expect(formalityOk([p('a', 'top', [], { formality: 'casual' }), p('b', 'bottom')])).toBe(true);
  });
});

describe('generateOutfits', () => {
  const closet = [
    p('t1', 'top', ['white']), p('t2', 'top', ['red']),
    p('b1', 'bottom', ['navy']), p('b2', 'bottom', ['green']),
    p('s1', 'shoes', ['black']), p('o1', 'outerwear', ['gray']), p('d1', 'dress', ['blue'])
  ];

  it('returns complete outfits with a base layer', () => {
    const out = generateOutfits(closet, { rng: rng(), count: 3 });
    expect(out.length).toBeGreaterThan(0);
    for (const o of out) {
      const cats = o.items.map(i => i.category);
      expect(cats.includes('dress') || (cats.includes('top') && cats.includes('bottom'))).toBe(true);
      expect(cats.includes('dress') && cats.includes('top')).toBe(false);
    }
  });

  it('never pairs clashing brights (red top + green bottom)', () => {
    for (let s = 1; s <= 20; s++)
      for (const o of generateOutfits(closet, { rng: rng(s), count: 5 })) {
        const ids = o.items.map(i => i.id);
        expect(ids.includes('t2') && ids.includes('b2')).toBe(false);
      }
  });

  it('respects season and never adds outerwear in summer', () => {
    const c = [...closet.slice(0, 5), p('o2', 'outerwear', ['black'], { seasons: ['winter'] }), p('wt', 'top', ['white'], { seasons: ['winter'] })];
    for (let s = 1; s <= 10; s++)
      for (const o of generateOutfits(c, { season: 'summer', rng: rng(s) }))
        expect(o.items.some(i => i.category === 'outerwear' || i.id === 'wt')).toBe(false);
  });

  it('always includes outerwear in winter when available', () => {
    const out = generateOutfits(closet, { season: 'winter', rng: rng(3) });
    expect(out.every(o => o.items.some(i => i.category === 'outerwear'))).toBe(true);
  });

  it('builds around an anchor', () => {
    for (let s = 1; s <= 10; s++)
      for (const o of generateOutfits(closet, { anchorId: 't2', rng: rng(s) }))
        expect(o.items.some(i => i.id === 't2')).toBe(true);
    const dress = generateOutfits(closet, { anchorId: 'd1', rng: rng(2) });
    expect(dress.every(o => o.items[0].id === 'd1')).toBe(true);
  });

  it('formality filter excludes mismatches but keeps untagged pieces', () => {
    const c = [p('t', 'top', ['white'], { formality: 'formal' }), p('t0', 'top', ['gray']), p('b', 'bottom', ['black'])];
    for (const o of generateOutfits(c, { formality: 'casual', rng: rng() })) expect(o.items.some(i => i.id === 't')).toBe(false);
  });

  it('skips untagged items and explains empty results', () => {
    const c = [p('x', null, ['red']), p('t', 'top', ['white'])];
    expect(generateOutfits(c, { rng: rng() })).toEqual([]);
    expect(explainEmpty(c)).toMatch(/top and one bottom/);
    expect(explainEmpty([p('x', null)])).toMatch(/Tag your items/);
  });

  it('works without shoes and is deterministic for a seed', () => {
    const c = [p('t', 'top', ['white']), p('b', 'bottom', ['navy'])];
    const a = generateOutfits(c, { rng: rng(7) }), b = generateOutfits(c, { rng: rng(7) });
    expect(a.length).toBe(1);
    expect(a.map(o => o.items.map(i => i.id))).toEqual(b.map(o => o.items.map(i => i.id)));
  });
});
