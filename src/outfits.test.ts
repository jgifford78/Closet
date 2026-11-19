import { describe, expect, it } from 'vitest';
import { colorScore, explainEmpty, formalityOk, generateOutfits, pairScore, wornPenalty, type Piece } from './outfits';

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

describe('worn log', () => {
  const now = Date.UTC(2026, 10, 17);
  const day = 86_400_000;
  it('penalizes recent wear only, capped', () => {
    const items = [p('a', 'top'), p('b', 'bottom'), p('c', 'shoes'), p('d', 'outerwear')];
    expect(wornPenalty(items, { a: now - day }, now)).toBe(0.15);
    expect(wornPenalty(items, { a: now - 5 * day }, now)).toBe(0.08);
    expect(wornPenalty(items, { a: now - 20 * day }, now)).toBe(0);
    expect(wornPenalty(items, { a: now, b: now, c: now, d: now }, now)).toBe(0.4);
  });
  it('prefers rested pieces when two outfits are otherwise equal', () => {
    const c = [p('t1', 'top', ['white']), p('t2', 'top', ['white']), p('b', 'bottom', ['navy'])];
    let t2First = 0;
    for (let s = 1; s <= 30; s++) {
      const [first] = generateOutfits(c, { rng: rng(s), count: 1, lastWorn: { t1: now - day }, now });
      if (first.items.some(i => i.id === 't2')) t2First++;
    }
    expect(t2First).toBeGreaterThan(20);
  });
});

describe('accessories', () => {
  const base = [p('t1', 'top', ['white']), p('t2', 'top', ['blue']), p('b1', 'bottom', ['navy']), p('b2', 'bottom', ['black']), p('s1', 'shoes', ['black'])];
  const acc = (id: string, type: Piece['accessoryType'], colors: Piece['colors'] = [], extra: Partial<Piece> = {}): Piece =>
    ({ ...p(id, 'accessory', colors, extra), accessoryType: type });
  const run = (closet: Piece[], opts = {}, seeds = 100) => {
    const all: Array<ReturnType<typeof generateOutfits>[number]> = [];
    for (let s = 1; s <= seeds; s++) all.push(...generateOutfits(closet, { rng: rng(s), ...opts }));
    return all;
  };
  const has = (o: { items: Piece[] }, id: string) => o.items.some(i => i.id === id);
  const share = (outfits: Array<{ items: Piece[] }>, id: string) => outfits.filter(o => has(o, id)).length / outfits.length;

  it('includes untyped accessories in most outfits', () => {
    expect(share(run([...base, p('a1', 'accessory', ['gray'])]), 'a1')).toBeGreaterThan(0.4);
  });

  it('color does not matter for sunglasses, watches and jewelry', () => {
    // red/yellow accessories on a green outfit would clash as clothing; here they should still appear
    const closet = [p('t', 'top', ['green']), p('b', 'bottom', ['black']), p('s', 'shoes', ['black']),
      acc('sun', 'sunglasses', ['red']), acc('w', 'watch', ['yellow']), acc('r', 'jewelry', ['red'])];
    const o = run(closet);
    expect(share(o, 'sun')).toBeGreaterThan(0.15);
    expect(share(o, 'w')).toBeGreaterThan(0.3);
    expect(share(o, 'r')).toBeGreaterThan(0.3);
  });

  it('color still matters for belts, hats, bags, scarves and ties', () => {
    const closet = [p('t', 'top', ['green'], { formality: 'smart' }), p('b', 'bottom', ['black']), p('s', 'shoes', ['black']),
      acc('hat', 'hat', ['red']), acc('bag', 'bag', ['red']), acc('scarf', 'scarf', ['red']), acc('tie', 'tie', ['red'], { formality: 'smart' })];
    expect(run(closet).some(o => o.items.some(i => i.category === 'accessory'))).toBe(false);
  });

  it('allows several accessories at once, and stacks jewelry but not other types', () => {
    const closet = [...base, acc('belt1', 'belt', ['black']), acc('belt2', 'belt', ['black']), acc('w', 'watch'),
      acc('j1', 'jewelry'), acc('j2', 'jewelry'), acc('j3', 'jewelry'), acc('j4', 'jewelry'), acc('g', 'sunglasses')];
    const o = run(closet, {}, 150);
    const counts = o.map(x => x.items.filter(i => i.category === 'accessory').length);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
    for (const x of o) {
      expect(x.items.filter(i => i.accessoryType === 'belt').length).toBeLessThanOrEqual(1);
      expect(x.items.filter(i => i.accessoryType === 'jewelry').length).toBeLessThanOrEqual(3);
    }
    expect(o.some(x => x.items.filter(i => i.accessoryType === 'jewelry').length >= 2)).toBe(true);
  });

  it('belts match the shoes and need pants', () => {
    const closet = [...base.filter(i => i.id !== 's1'), p('s1', 'shoes', ['black']), acc('brown', 'belt', ['brown']), acc('black', 'belt', ['black'])];
    const o = run(closet);
    expect(o.some(x => has(x, 'brown'))).toBe(false); // brown belt + black shoes never
    expect(share(o, 'black')).toBeGreaterThan(0.3);
    const dressOnly = [p('d', 'dress', ['blue']), p('s', 'shoes', ['black']), acc('belt', 'belt', ['black'])];
    expect(run(dressOnly).some(x => has(x, 'belt'))).toBe(false);
  });

  it('ties only with dressy outfits and never with a dress', () => {
    const tie = acc('tie', 'tie', ['navy'], { formality: 'smart' });
    const casual = [p('t', 'top', ['white'], { formality: 'casual' }), p('b', 'bottom', ['black'], { formality: 'casual' }), tie];
    expect(run(casual).some(x => has(x, 'tie'))).toBe(false);
    const dressy = [p('t', 'top', ['white'], { formality: 'smart' }), p('b', 'bottom', ['black'], { formality: 'smart' }), tie];
    expect(share(run(dressy), 'tie')).toBeGreaterThan(0.3);
    expect(run([p('d', 'dress', ['blue'], { formality: 'smart' }), tie]).some(x => has(x, 'tie'))).toBe(false);
  });

  it('no scarf in summer', () => {
    const closet = [...base, acc('sc', 'scarf', ['gray'])];
    expect(run(closet, { season: 'summer' }).some(x => has(x, 'sc'))).toBe(false);
    expect(run(closet, { season: 'winter' }).some(x => has(x, 'sc'))).toBe(true);
  });

  it('anchor accessory is always present when it fits', () => {
    const closet = [...base, acc('g', 'sunglasses', ['red'])];
    const out = generateOutfits(closet, { anchorId: 'g', rng: rng(4) });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every(o => has(o, 'g'))).toBe(true);
  });
});
