import type { AccessoryType, Category } from './db';
import type { ColorName } from './colors';
import { ACCESSORY_LABEL, accessoryTypeFromName, defaultName } from './classify';

export interface Described { category: Category | null; accessoryType: AccessoryType | null; colors: ColorName[]; name: string }

interface Current { category: Category | null; accessoryType?: AccessoryType | null; colors: ColorName[] }

/**
 * Combine what the user already set with what was detected.
 * User choices win: existing category/colors are kept, detection only fills gaps.
 * The specific type ("Pants") is used only if detection agrees with the final category.
 */
export function buildDescription(
  current: Current,
  detectedColors: ColorName[],
  detected: { category: Category | null; type: string | null } | null
): Described {
  const colors = current.colors.length ? current.colors : detectedColors;
  const category = current.category ?? detected?.category ?? null;
  const accessoryType: AccessoryType | null = category === 'accessory'
    ? current.accessoryType ?? (detected?.category === 'accessory' ? accessoryTypeFromName(detected.type) : null)
    : null;
  const type = accessoryType ? ACCESSORY_LABEL[accessoryType] : detected && detected.category === category ? detected.type : null;
  return { category, accessoryType, colors, name: defaultName(category, colors, type) };
}

/** Run color extraction + on-device type detection for an existing photo. */
export async function describeItem(
  photo: Blob,
  hasAlpha: boolean,
  current: Current
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
