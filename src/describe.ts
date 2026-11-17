import type { Category } from './db';
import type { ColorName } from './colors';
import { defaultName } from './classify';

export interface Described { category: Category | null; colors: ColorName[]; name: string }

/**
 * Combine what the user already set with what was detected.
 * User choices win: existing category/colors are kept, detection only fills gaps.
 * The specific type ("Pants") is used only if detection agrees with the final category.
 */
export function buildDescription(
  current: { category: Category | null; colors: ColorName[] },
  detectedColors: ColorName[],
  detected: { category: Category | null; type: string | null } | null
): Described {
  const colors = current.colors.length ? current.colors : detectedColors;
  const category = current.category ?? detected?.category ?? null;
  const type = detected && detected.category === category ? detected.type : null;
  return { category, colors, name: defaultName(category, colors, type) };
}

/** Run color extraction + on-device type detection for an existing photo. */
export async function describeItem(
  photo: Blob,
  hasAlpha: boolean,
  current: { category: Category | null; colors: ColorName[] }
): Promise<Described> {
  const { extractColors, flattenOnWhite } = await import('./image');
  const { classifyItem } = await import('./classify');
  const detectedColors = current.colors.length ? [] : await extractColors(photo, hasAlpha).catch(() => []);
  let detected: { category: Category | null; type: string | null } | null = null;
  const url = URL.createObjectURL(await flattenOnWhite(photo));
  try {
    detected = await classifyItem(url);
  } catch (e) {
    console.warn('Type detection failed', e);
  } finally {
    URL.revokeObjectURL(url);
  }
  return buildDescription(current, detectedColors, detected);
}
