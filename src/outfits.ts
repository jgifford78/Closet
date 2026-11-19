import type { Category, Formality, Season } from './db';
import type { ColorName } from './colors';

/** The fields the rules need; the UI passes full ClosetItems. */
export interface Piece {
  id: string;
  category: Category | null;
  colors: ColorName[];
  seasons: Season[];
  formality: Formality | null;
}

export interface Outfit<T extends Piece> {
  items: T[];
  score: number;
}

export interface Options {
  season?: Season | null;        // null/undefined = any
  formality?: Formality | null;  // exact match, items without formality always pass
  anchorId?: string | null;      // build the outfit around this item
  count?: number;                // outfits to return (default 3)
  attempts?: number;             // random tries (default 600)
  lastWorn?: Record<string, number>; // itemId -> timestamp last worn; recent pieces are de-prioritized
  now?: number;
  rng?: () => number;
}

// ---- Color rules ---------------------------------------------------------

const NEUTRALS: ReadonlySet<ColorName> = new Set(['black', 'white', 'gray', 'beige', 'navy', 'brown']);
const HUE: Partial<Record<ColorName, number>> = {
  red: 0, orange: 30, yellow: 55, green: 125, blue: 220, purple: 280, pink: 335
};
const BAD_NEUTRAL_PAIRS = new Map<string, number>([
  ['black|brown', 0.45], ['brown|gray', 0.6], ['black|navy', 0.7]
]);

export const isNeutral = (c: ColorName) => NEUTRALS.has(c);

/** 0..1 how well two main colors work together. */
export function pairScore(a: ColorName | undefined, b: ColorName | undefined): number {
  if (!a || !b) return 0.7; // unknown color: don't punish, don't reward
  if (a === b) return 0.85;
  const na = isNeutral(a), nb = isNeutral(b);
  if (na && nb) return BAD_NEUTRAL_PAIRS.get([a, b].sort().join('|')) ?? 0.9;
  if (na || nb) return 0.95;
  const d = Math.abs(HUE[a]! - HUE[b]!);
  const diff = Math.min(d, 360 - d);
  if (diff <= 60) return 0.8;  // analogous
  if (diff >= 135) return 0.75; // complementary
  return 0.3;                   // clash
}

/** Lowest pair score across main colors (1 if fewer than two). One bad pair sinks an outfit. */
export function worstPair(colors: Array<ColorName | undefined>): number {
  let worst = 1;
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) worst = Math.min(worst, pairScore(colors[i], colors[j]));
  return worst;
}

/** Blend of average and worst pair; extra penalty for 3+ different bright colors. */
export function colorScore(colors: Array<ColorName | undefined>): number {
  let sum = 0, n = 0;
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) { sum += pairScore(colors[i], colors[j]); n++; }
  const avg = n ? sum / n : 1;
  const blended = 0.6 * avg + 0.4 * worstPair(colors);
  const bright = new Set(colors.filter((c): c is ColorName => !!c && !isNeutral(c)));
  return bright.size >= 3 ? blended * 0.5 : blended;
}

// ---- Formality / season --------------------------------------------------

const FORMALITY_RANK: Record<Formality, number> = { casual: 0, smart: 1, formal: 2 };

/** Hard rule: no two pieces more than one step apart (casual + formal never mix). */
export function formalityOk(items: Piece[]): boolean {
  const ranks = items.filter(i => i.formality).map(i => FORMALITY_RANK[i.formality!]);
  return ranks.length < 2 || Math.max(...ranks) - Math.min(...ranks) <= 1;
}

function formalityCohesion(items: Piece[]): number {
  const ranks = new Set(items.filter(i => i.formality).map(i => i.formality));
  return ranks.size <= 1 ? 1 : 0.6;
}

const seasonOk = (i: Piece, season?: Season | null) => !season || !i.seasons.length || i.seasons.includes(season);
const formalityMatches = (i: Piece, f?: Formality | null) => !f || !i.formality || i.formality === f;

/** Score penalty for pieces worn recently: 0.15 within 3 days, 0.08 within a week, capped at 0.4 total. */
export function wornPenalty(items: Piece[], lastWorn: Record<string, number> = {}, now = Date.now()): number {
  let penalty = 0;
  for (const i of items) {
    const at = lastWorn[i.id];
    if (at === undefined) continue;
    const days = (now - at) / 86_400_000;
    penalty += days < 3 ? 0.15 : days < 7 ? 0.08 : 0;
  }
  return Math.min(penalty, 0.4);
}

// ---- Generation ----------------------------------------------------------

const pick = <T,>(list: T[], rng: () => number): T | undefined => list[Math.floor(rng() * list.length)];

/** Chance of adding a jacket for the chosen season. */
function outerwearChance(season?: Season | null): number {
  if (season === 'winter') return 1;
  if (season === 'summer') return 0;
  return 0.5;
}

/**
 * Build outfits from a closet. Shape: (top + bottom | dress) [+ shoes] [+ outerwear] [+ accessory].
 * Random sampling keeps it fast for big closets and gives variety on every shuffle.
 */
export function generateOutfits<T extends Piece>(closet: T[], opts: Options = {}): Outfit<T>[] {
  const { season = null, formality = null, anchorId = null, count = 3, attempts = 600, rng = Math.random, lastWorn, now = Date.now() } = opts;

  const usable = closet.filter(i => i.category && seasonOk(i, season) && formalityMatches(i, formality));
  const by = (c: Category) => usable.filter(i => i.category === c);
  const anchor = anchorId ? closet.find(i => i.id === anchorId) : undefined;
  if (anchorId && (!anchor || !anchor.category)) return [];

  const tops = by('top'), bottoms = by('bottom'), dresses = by('dress');
  const shoes = by('shoes'), outer = by('outerwear'), accessories = by('accessory');
  const force = (slot: Category, list: T[]) => (anchor?.category === slot ? [anchor] : list);

  const seen = new Map<string, Outfit<T>>();
  for (let n = 0; n < attempts; n++) {
    // Base layer: dress or top+bottom.
    const useDress = anchor?.category === 'dress' || (!anchor && dresses.length > 0 && (!tops.length || !bottoms.length || rng() < 0.25));
    const base: T[] = [];
    if (useDress) {
      const d = pick(force('dress', dresses), rng);
      if (!d) continue;
      base.push(d);
    } else {
      const t = pick(force('top', tops), rng), b = pick(force('bottom', bottoms), rng);
      if (!t || !b) continue;
      base.push(t, b);
    }
    const items: T[] = [...base];

    const s = pick(force('shoes', shoes), rng);
    if (s) items.push(s);

    const wantOuter = anchor?.category === 'outerwear' || rng() < outerwearChance(season);
    const o = wantOuter ? pick(force('outerwear', outer), rng) : undefined;
    if (o) items.push(o);

    if (!formalityOk(items)) continue;
    const main = items.map(i => i.colors[0]);
    let cs = colorScore(main);
    if (worstPair(main) < 0.4 || cs < 0.5) continue; // any clashing pair rejects the outfit

    // Accessory: most outfits get one. Choose the best color match from the whole pool
    // (with a little jitter so different accessories rotate); skip any that clash.
    let hasAccessory = false;
    if (accessories.length && (anchor?.category === 'accessory' || rng() < 0.7)) {
      let best: T | undefined, bestScore = -1;
      for (const a of force('accessory', accessories)) {
        const withA = [...items, a];
        if (!formalityOk(withA) || worstPair(withA.map(i => i.colors[0])) < 0.4) continue;
        const sc = colorScore(withA.map(i => i.colors[0])) + rng() * 0.12;
        if (sc > bestScore) { best = a; bestScore = sc; }
      }
      if (best) { items.push(best); hasAccessory = true; }
    }
    if (anchor && !items.includes(anchor)) continue;

    // cs is from the core pieces, so an accessory doesn't dilute the score; small bonus keeps parity.
    const score = Math.max(0.01, cs * 0.7 + formalityCohesion(items) * 0.3 + (hasAccessory ? 0.02 : 0) - wornPenalty(items, lastWorn, now));
    // One candidate per core combination, preferring the variant that has an accessory.
    const key = items.filter(i => i.category !== 'accessory').map(i => i.id).sort().join('|');
    const prev = seen.get(key);
    if (!prev || (hasAccessory && !prev.items.some(i => i.category === 'accessory'))) seen.set(key, { items, score });
  }

  // Weighted pick from the best candidates so "Shuffle" varies without surfacing junk.
  const ranked = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, Math.max(count * 6, 12));
  const out: Outfit<T>[] = [];
  while (out.length < count && ranked.length) {
    // Higher score = more likely; recently worn pieces are strongly de-prioritized.
    const weight = (o: Outfit<T>) => o.score ** 4 * Math.exp(-8 * wornPenalty(o.items, lastWorn, now));
    const total = ranked.reduce((s, o) => s + weight(o), 0);
    let r = rng() * total, idx = 0;
    for (; idx < ranked.length - 1; idx++) { r -= weight(ranked[idx]); if (r <= 0) break; }
    out.push(ranked.splice(idx, 1)[0]);
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Why nothing was generated, in plain words. */
export function explainEmpty(closet: Piece[], opts: Options = {}): string {
  const has = (c: Category) => closet.some(i => i.category === c);
  if (!closet.some(i => i.category)) return 'Tag your items with a category first.';
  if (!has('dress') && !(has('top') && has('bottom'))) return 'Add at least one top and one bottom (or a dress).';
  if (opts.anchorId) return 'Nothing matches that item with the current filters. Try loosening season or formality.';
  return 'No combinations match the current filters. Try season “any” or a different formality.';
}
