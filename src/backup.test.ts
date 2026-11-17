import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup, restoreBackup } from './backup';
import { addItem, deleteItem, listItems, listSavedOutfits, listWorn, logWorn, saveOutfit, updateItem } from './db';

describe('backup', () => {
  it('round-trips items, outfits and worn log', async () => {
    const a = await addItem({ name: 'A', photo: new Blob(['photo-a'], { type: 'image/png' }), backgroundRemoved: true });
    const b = await addItem({ name: 'B', photo: new Blob(['photo-b'], { type: 'image/jpeg' }), backgroundRemoved: false });
    await updateItem(a.id, { category: 'top', colors: ['navy'], seasons: ['fall'], formality: 'smart', name: 'Navy Top' });
    await saveOutfit([a.id, b.id]);
    await logWorn([a.id], 1000);

    const backup = await createBackup();
    await deleteItem(a.id);
    await deleteItem(b.id);
    expect(await listItems()).toEqual([]);
    expect(await listSavedOutfits()).toEqual([]); // outfits pruned with their items

    expect(await restoreBackup(backup)).toEqual({ items: 2, outfits: 1, worn: 0 }); // worn entry survived delete
    const items = await listItems();
    const restored = items.find(i => i.id === a.id)!;
    expect(restored).toMatchObject({ name: 'Navy Top', category: 'top', colors: ['navy'], formality: 'smart' });
    expect(await restored.photo.text()).toBe('photo-a');
    expect(restored.photo.type).toBe('image/png');
    expect((await listSavedOutfits()).length).toBe(1);
    expect((await listWorn()).length).toBe(1);
  });

  it('is a merge: restoring twice adds nothing', async () => {
    const backup = await createBackup();
    expect(await restoreBackup(backup)).toEqual({ items: 0, outfits: 0, worn: 0 });
  });

  it('rejects files that are not backups', async () => {
    await expect(parseBackup(new Blob(['hello']))).rejects.toThrow(/not a Closet backup/);
    await expect(parseBackup(new Blob([JSON.stringify({ format: 'other' })]))).rejects.toThrow(/not a Closet backup/);
    await expect(parseBackup(new Blob([JSON.stringify({ format: 'closet-backup', version: 1, items: [{ id: 'x' }] })]))).rejects.toThrow(/damaged/);
  });
});
