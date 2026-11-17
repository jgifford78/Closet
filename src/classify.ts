import type { Category, Season } from './db';

/** CLIP prompts -> category. Several prompts per category; their scores are summed. */
export const PROMPTS: Array<[prompt: string, category: Category]> = [
  ['a photo of a t-shirt', 'top'],
  ['a photo of a button-up shirt or blouse', 'top'],
  ['a photo of a sweater or hoodie', 'top'],
  ['a photo of pants or jeans', 'bottom'],
  ['a photo of shorts', 'bottom'],
  ['a photo of a skirt', 'bottom'],
  ['a photo of a dress', 'dress'],
  ['a photo of a jacket or coat', 'outerwear'],
  ['a photo of a blazer', 'outerwear'],
  ['a photo of shoes or sneakers', 'shoes'],
  ['a photo of boots', 'shoes'],
  ['a photo of a hat, belt, scarf, bag or sunglasses', 'accessory']
];

export interface Scored { label: string; score: number }

/** Sum prompt scores per category; return the best category if it is confident enough. */
export function pickCategory(results: Scored[], minScore = 0.35): { category: Category | null; score: number } {
  const byLabel = new Map(PROMPTS);
  const totals = new Map<Category, number>();
  for (const { label, score } of results) {
    const c = byLabel.get(label);
    if (c) totals.set(c, (totals.get(c) ?? 0) + score);
  }
  let best: Category | null = null;
  let bestScore = 0;
  for (const [c, s] of totals) if (s > bestScore) [best, bestScore] = [c, s];
  return bestScore >= minScore ? { category: best, score: bestScore } : { category: null, score: bestScore };
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
export async function classifyCategory(imageUrl: string): Promise<Category | null> {
  const run = await load();
  const results = await run(imageUrl, PROMPTS.map(([p]) => p));
  return pickCategory(results).category;
}
