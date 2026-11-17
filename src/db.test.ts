import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addItem, deleteItem, listItems } from './db';

describe('closet store', () => {
  it('adds, lists newest-first, and deletes', async () => {
    const a = await addItem({ name: 'a', photo: new Blob(['a']), backgroundRemoved: false });
    await new Promise(r => setTimeout(r, 2));
    const b = await addItem({ name: 'b', photo: new Blob(['b']), backgroundRemoved: true });
    expect((await listItems()).map(i => i.id)).toEqual([b.id, a.id]);
    await deleteItem(a.id);
    expect((await listItems()).map(i => i.id)).toEqual([b.id]);
  });
});
