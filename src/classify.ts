import type { AccessoryType, Category, Season } from './db';

/** CLIP prompts -> category. Several prompts per category; their scores are summed. */
export const PROMPTS: Array<[prompt: string, category: Category, typeName: string]> = [
  ['a photo of a t-shirt', 'top', 'T-shirt'],
  ['a photo of a button-up shirt or blouse', 'top', 'Shirt'],
  ['a photo of a sweater or hoodie', 'top', 'Sweater'],
  ['a photo of pants or jeans', 'bottom', 'Pants'],
  ['a photo of shorts', 'bottom', 'Shorts'],
  ['a photo of a skirt', 'bottom', 'Skirt'],
  ['a photo of a dress', 'dress', 'Dress'],
  ['a photo of a jacket or coat', 'outerwear', 'Jacket'],
  ['a photo of a blazer', 'outerwear', 'Blazer'],
  ['a photo of shoes or sneakers', 'shoes', 'Shoes'],
  ['a photo of boots', 'shoes', 'Boots'],
  ['a photo of a hat or cap', 'accessory', 'Hat'],
  ['a photo of a belt', 'accessory', 'Belt'],
  ['a photo of a handbag or backpack', 'accessory', 'Bag'],
  ['a photo of a scarf', 'accessory', 'Scarf'],
  ['a photo of sunglasses', 'accessory', 'Sunglasses'],
  ['a photo of a wristwatch', 'accessory', 'Watch'],
  ['a photo of a ring, necklace, chain or bracelet', 'accessory', 'Jewelry'],
  ['a photo of a necktie', 'accessory', 'Tie']
];

export interface Scored { label: string; score: number }

/** Sum prompt scores per category; return the best category (and its best-matching type name) if confident. */
export function pickCategory(results: Scored[], minScore = 0.35): { category: Category | null; type: string | null; score: number } {
  const byLabel = new Map(PROMPTS.map(([prompt, c, t]) => [prompt, { c, t }]));
  const totals = new Map<Category, number>();
  const bestType = new Map<Category, { t: string; s: number }>();
  for (const { label, score } of results) {
    const e = byLabel.get(label);
    if (!e) continue;
    totals.set(e.c, (totals.get(e.c) ?? 0) + score);
    if (score > (bestType.get(e.c)?.s ?? -1)) bestType.set(e.c, { t: e.t, s: score });
  }
  let best: Category | null = null;
  let bestScore = 0;
  for (const [c, s] of totals) if (s > bestScore) [best, bestScore] = [c, s];
  if (!best || bestScore < minScore) return { category: null, type: null, score: bestScore };
  return { category: best, type: bestType.get(best)?.t ?? null, score: bestScore };
}

/** Type names the classifier emits for accessories -> accessory type. */
const ACCESSORY_BY_NAME: Record<string, AccessoryType> = {
  Hat: 'hat', Belt: 'belt', Bag: 'bag', Scarf: 'scarf', Sunglasses: 'sunglasses', Watch: 'watch', Jewelry: 'jewelry', Tie: 'tie'
};
export const ACCESSORY_LABEL: Record<AccessoryType, string> = {
  hat: 'Hat', belt: 'Belt', bag: 'Bag', scarf: 'Scarf', sunglasses: 'Sunglasses', watch: 'Watch', jewelry: 'Jewelry', tie: 'Tie'
};
export const accessoryTypeFromName = (name?: string | null): AccessoryType | null => (name && ACCESSORY_BY_NAME[name]) || null;
/** Colors say little about these, so default names leave them out ("Watch", not "Gray Watch"). */
const COLORLESS_NAMES = new Set(['Watch', 'Jewelry', 'Sunglasses']);

const GENERIC_TYPE: Record<Category, string> = {
  top: 'Top', bottom: 'Pants', dress: 'Dress', outerwear: 'Jacket', shoes: 'Shoes', accessory: 'Accessory'
};

/** Default item name, e.g. "Navy Pants". Falls back to "New item" when nothing is known. */
export function defaultName(category: Category | null, colors: string[], type?: string | null): string {
  const base = type ?? (category ? GENERIC_TYPE[category] : null);
  if (!base) return 'New item';
  const color = colors[0] && !COLORLESS_NAMES.has(base) ? colors[0][0].toUpperCase() + colors[0].slice(1) : '';
  return color ? `${color} ${base}` : base;
}

/** Only suggest seasons where category implies them; everything else stays for the user. */
export function defaultSeasons(category: Category | null): Season[] {
  return category === 'outerwear' ? ['fall', 'winter'] : [];
}

type Classifier = (image: string, labels: string[]) => Promise<Scored[]>;
let classifier: Promise<Classifier> | undefined;

function load(): Promise<Classifier> {
  classifier ??= import('@huggingface/transformers').then(async ({ pipeline }) => {
    const pipe = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
    return (image, labels) => pipe(image, labels) as Promise<Scored[]>;
  });
  // Allow a retry if loading fails (e.g. offline on first use).
  classifier.catch(() => (classifier = undefined));
  return classifier;
}

/** On-device guess of the clothing category. Model downloads on first use, then is cached. */
export async function classifyItem(imageUrl: string): Promise<{ category: Category | null; type: string | null; accessoryType: AccessoryType | null }> {
  const run = await load();
  const results = await run(imageUrl, PROMPTS.map(([p]) => p));
  const { category, type } = pickCategory(results);
  return { category, type, accessoryType: category === 'accessory' ? accessoryTypeFromName(type) : null };
}
