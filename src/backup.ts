import { mergeAll, readAll, type ClosetItem, type Snapshot } from './db';

const FORMAT = 'closet-backup';

interface BackupItem extends Omit<ClosetItem, 'photo'> { photo: { type: string; data: string } }
interface BackupFile { format: typeof FORMAT; version: 1; exportedAt: string; items: BackupItem[]; outfits: Snapshot['outfits']; worn: Snapshot['worn'] }

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Everything (items with photos, saved outfits, worn log) as one JSON file. */
export async function createBackup(): Promise<Blob> {
  const snap = await readAll();
  const items: BackupItem[] = [];
  for (const it of snap.items) items.push({ ...it, photo: { type: it.photo.type || 'image/png', data: await blobToBase64(it.photo) } });
  const file: BackupFile = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), items, outfits: snap.outfits, worn: snap.worn };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

/** Parse and validate a backup file. Throws a readable Error if it isn't one of ours. */
export async function parseBackup(file: Blob): Promise<Snapshot> {
  let raw: Partial<BackupFile>;
  try { raw = JSON.parse(await file.text()); } catch { throw new Error('That file is not a Closet backup.'); }
  if (raw.format !== FORMAT || raw.version !== 1 || !Array.isArray(raw.items)) throw new Error('That file is not a Closet backup.');
  const items = raw.items.map(i => {
    if (!i?.id || !i.photo?.data) throw new Error('Backup file is damaged (an item is missing data).');
    return { ...i, photo: base64ToBlob(i.photo.data, i.photo.type) } as ClosetItem;
  });
  return { items, outfits: Array.isArray(raw.outfits) ? raw.outfits : [], worn: Array.isArray(raw.worn) ? raw.worn : [] };
}

/** Merge a backup into the closet. Items already present are left as they are. */
export async function restoreBackup(file: Blob): Promise<{ items: number; outfits: number; worn: number }> {
  return mergeAll(await parseBackup(file));
}
