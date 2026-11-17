import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface ClosetItem {
  id: string;
  name: string;
  createdAt: number;
  /** Photo shown in the grid (background-removed PNG when available). */
  photo: Blob;
  backgroundRemoved: boolean;
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

export async function addItem(input: Pick<ClosetItem, 'name' | 'photo' | 'backgroundRemoved'>): Promise<ClosetItem> {
  const item: ClosetItem = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
  await (await db()).put('items', item);
  return item;
}

export async function listItems(): Promise<ClosetItem[]> {
  const all = await (await db()).getAllFromIndex('items', 'by-created');
  return all.reverse(); // newest first
}

export async function deleteItem(id: string): Promise<void> {
  await (await db()).delete('items', id);
}
