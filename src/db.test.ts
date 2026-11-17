import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addItem, deleteItem, listItems, updateItem } from './db';

describe('closet store', () => {
  it('adds, lists newest-first, and deletes', async () => {
    const a = await addItem({ name: 'a', photo: new Blob(['a']), backgroundRemoved: false });
    await new Promise(r => setTimeout(r, 2));
    const b = await addItem({ name: 'b', photo: new Blob(['b']), backgroundRemoved: true });
    expect((await listItems()).map(i => i.id)).toEqual([b.id, a.id]);
    await deleteItem(a.id);
    expect((await listItems()).map(i => i.id)).toEqual([b.id]);
  });

  it('defaults tags and updates them', async () => {
    const it = await addItem({ name: 'x', photo: new Blob(['x']), backgroundRemoved: false });
    expect(it).toMatchObject({ category: null, colors: [], seasons: [], formality: null, autoNamed: false });
    const next = await updateItem(it.id, { category: 'top', colors: ['blue'], seasons: ['summer'], formality: 'casual' });
    expect(next).toMatchObject({ category: 'top', colors: ['blue'], seasons: ['summer'], formality: 'casual' });
    expect((await listItems()).find(i => i.id === it.id)?.category).toBe('top');
    expect(await updateItem('missing', { name: 'n' })).toBeUndefined();
  });
});
