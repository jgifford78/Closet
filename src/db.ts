import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ColorName } from './colors';

export const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'] as const;
export type Category = (typeof CATEGORIES)[number];
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
  /** Most prominent first. */
  colors: ColorName[];
  seasons: Season[];
  formality: Formality | null;
  /** True while the name is generated (not typed by the user), so it can follow category/color edits. */
  autoNamed: boolean;
}

interface ClosetDB extends DBSchema {
  items: { key: string; value: ClosetItem; indexes: { 'by-created': number } };
}

let dbPromise: Promise<IDBPDatabase<ClosetDB>> | undefined;

function db() {
  dbPromise ??= openDB<ClosetDB>('closet', 1, {
    upgrade(d) {
      d.createObjectStore('items', { keyPath: 'id' }).createIndex('by-created', 'createdAt');
    }
  });
  return dbPromise;
}

/** Fill tag fields missing on items saved by milestone 2. No schema bump needed. */
function normalize(raw: Partial<ClosetItem> & Pick<ClosetItem, 'id' | 'name' | 'createdAt' | 'photo' | 'backgroundRemoved'>): ClosetItem {
  return {
    category: null,
    colors: [],
    seasons: [],
    formality: null,
    autoNamed: raw.name === 'New item',
    ...raw
  };
}

export type NewItem = Pick<ClosetItem, 'name' | 'photo' | 'backgroundRemoved'> &
  Partial<Pick<ClosetItem, 'category' | 'colors' | 'seasons' | 'formality' | 'autoNamed'>>;

export async function addItem(input: NewItem): Promise<ClosetItem> {
  const item = normalize({ id: crypto.randomUUID(), createdAt: Date.now(), ...input });
  await (await db()).put('items', item);
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<ClosetItem, 'name' | 'category' | 'colors' | 'seasons' | 'formality' | 'autoNamed'>>
): Promise<ClosetItem | undefined> {
  const d = await db();
  const current = await d.get('items', id);
  if (!current) return undefined;
  const next = normalize({ ...current, ...patch });
  await d.put('items', next);
  return next;
}

export async function listItems(): Promise<ClosetItem[]> {
  const all = await (await db()).getAllFromIndex('items', 'by-created');
  return all.map(normalize).reverse(); // newest first
}

export async function deleteItem(id: string): Promise<void> {
  await (await db()).delete('items', id);
}
