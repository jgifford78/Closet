import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ColorName } from './colors';

export const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'] as const;
export type Category = (typeof CATEGORIES)[number];
export const ACCESSORY_TYPES = ['hat', 'belt', 'bag', 'scarf', 'sunglasses', 'watch', 'jewelry', 'tie'] as const;
export type AccessoryType = (typeof ACCESSORY_TYPES)[number];
export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const FORMALITIES = ['casual', 'smart', 'formal'] as const;
export type Formality = (typeof FORMALITIES)[number];

export interface ClosetItem {
  id: string;
  name: string;
  createdAt: number;
  /** Photo shown in the grid (background-removed PNG when available). */
  photo: Blob;
  backgroundRemoved: boolean;
  category: Category | null;
  /** Only meaningful when category is 'accessory'. */
  accessoryType: AccessoryType | null;
  /** Most prominent first. */
  colors: ColorName[];
  seasons: Season[];
  formality: Formality | null;
  /** True while the name is generated (not typed by the user), so it can follow category/color edits. */
  autoNamed: boolean;
  /** Bumped when the photo is replaced (crop) so cached object URLs refresh. */
  photoRev: number;
}

/** A favorited outfit. id is the sorted item ids joined, so saving twice is a no-op. */
export interface SavedOutfit { id: string; itemIds: string[]; createdAt: number }
/** One "I wore this" entry. */
export interface WornEntry { id: string; at: number; itemIds: string[] }

export const outfitKey = (itemIds: string[]) => [...itemIds].sort().join('|');

/** itemId -> timestamp it was last worn. */
export function lastWornMap(worn: WornEntry[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const w of worn) for (const id of w.itemIds) if (!m[id] || w.at > m[id]) m[id] = w.at;
  return m;
}

interface ClosetDB extends DBSchema {
  items: { key: string; value: ClosetItem; indexes: { 'by-created': number } };
  outfits: { key: string; value: SavedOutfit };
  worn: { key: string; value: WornEntry };
}

let dbPromise: Promise<IDBPDatabase<ClosetDB>> | undefined;

function db() {
  dbPromise ??= openDB<ClosetDB>('closet', 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) d.createObjectStore('items', { keyPath: 'id' }).createIndex('by-created', 'createdAt');
      if (oldVersion < 2) {
        d.createObjectStore('outfits', { keyPath: 'id' });
        d.createObjectStore('worn', { keyPath: 'id' });
      }
    }
  });
  return dbPromise;
}

/** Fill tag fields missing on items saved by milestone 2. No schema bump needed. */
function normalize(raw: Partial<ClosetItem> & Pick<ClosetItem, 'id' | 'name' | 'createdAt' | 'photo' | 'backgroundRemoved'>): ClosetItem {
  return {
    category: null,
    accessoryType: null,
    colors: [],
    seasons: [],
    formality: null,
    autoNamed: raw.name === 'New item',
    photoRev: 0,
    ...raw
  };
}

export type NewItem = Pick<ClosetItem, 'name' | 'photo' | 'backgroundRemoved'> &
  Partial<Pick<ClosetItem, 'category' | 'accessoryType' | 'colors' | 'seasons' | 'formality' | 'autoNamed'>>;

export async function addItem(input: NewItem): Promise<ClosetItem> {
  const item = normalize({ id: crypto.randomUUID(), createdAt: Date.now(), ...input });
  await (await db()).put('items', item);
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<ClosetItem, 'name' | 'category' | 'accessoryType' | 'colors' | 'seasons' | 'formality' | 'autoNamed' | 'photo' | 'backgroundRemoved'>>
): Promise<ClosetItem | undefined> {
  const d = await db();
  const current = await d.get('items', id);
  if (!current) return undefined;
  const next = normalize({ ...current, ...patch, photoRev: patch.photo ? current.photoRev + 1 : current.photoRev });
  await d.put('items', next);
  return next;
}

export async function listItems(): Promise<ClosetItem[]> {
  const all = await (await db()).getAllFromIndex('items', 'by-created');
  return all.map(normalize).reverse(); // newest first
}

/** Deleting an item also removes saved outfits that used it. */
export async function deleteItem(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['items', 'outfits'], 'readwrite');
  await tx.objectStore('items').delete(id);
  for (const o of await tx.objectStore('outfits').getAll())
    if (o.itemIds.includes(id)) await tx.objectStore('outfits').delete(o.id);
  await tx.done;
}

export async function saveOutfit(itemIds: string[]): Promise<SavedOutfit> {
  const o: SavedOutfit = { id: outfitKey(itemIds), itemIds, createdAt: Date.now() };
  await (await db()).put('outfits', o);
  return o;
}
export async function unsaveOutfit(id: string): Promise<void> {
  await (await db()).delete('outfits', id);
}
export async function listSavedOutfits(): Promise<SavedOutfit[]> {
  return (await (await db()).getAll('outfits')).sort((a, b) => b.createdAt - a.createdAt);
}

export async function logWorn(itemIds: string[], at = Date.now()): Promise<WornEntry> {
  const w: WornEntry = { id: crypto.randomUUID(), at, itemIds };
  await (await db()).put('worn', w);
  return w;
}
export async function listWorn(): Promise<WornEntry[]> {
  return (await db()).getAll('worn');
}

// ---- Backup support (raw access) ----

export interface Snapshot { items: ClosetItem[]; outfits: SavedOutfit[]; worn: WornEntry[] }

export async function readAll(): Promise<Snapshot> {
  const d = await db();
  return { items: (await d.getAll('items')).map(normalize), outfits: await d.getAll('outfits'), worn: await d.getAll('worn') };
}

/** Merge a snapshot in: existing ids are kept untouched. Outfits are only added if all their items exist. */
export async function mergeAll(snap: Snapshot): Promise<{ items: number; outfits: number; worn: number }> {
  const d = await db();
  const tx = d.transaction(['items', 'outfits', 'worn'], 'readwrite');
  const added = { items: 0, outfits: 0, worn: 0 };
  for (const it of snap.items)
    if (!(await tx.objectStore('items').get(it.id))) { await tx.objectStore('items').put(normalize(it)); added.items++; }
  for (const o of snap.outfits) {
    if (await tx.objectStore('outfits').get(o.id)) continue;
    const have = await Promise.all(o.itemIds.map(id => tx.objectStore('items').get(id)));
    if (have.every(Boolean)) { await tx.objectStore('outfits').put(o); added.outfits++; }
  }
  for (const w of snap.worn)
    if (!(await tx.objectStore('worn').get(w.id))) { await tx.objectStore('worn').put(w); added.worn++; }
  await tx.done;
  return added;
}
