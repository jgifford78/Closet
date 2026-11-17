import { useCallback, useEffect, useState } from 'react';
import { CATEGORIES, listItems, updateItem, type Category, type ClosetItem } from './db';
import { AddItem } from './components/AddItem';
import { ClosetGrid } from './components/ClosetGrid';
import { ItemEditor } from './components/ItemEditor';
import { defaultSeasons } from './classify';
import { describeItem } from './describe';

export function App() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [editing, setEditing] = useState<ClosetItem | null>(null);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [progress, setProgress] = useState<string | null>(null);
  const refresh = useCallback(() => listItems().then(setItems), []);
  useEffect(() => void refresh(), [refresh]);

  const shown = filter === 'all' ? items : items.filter(i => i.category === filter);
  // Older items that were never tagged and still have a generated (not typed) name.
  const unnamed = items.filter(i => i.autoNamed && !i.category);

  async function autoNameAll() {
    for (const [n, item] of unnamed.entries()) {
      setProgress(`Auto-naming ${n + 1}/${unnamed.length}…`);
      try {
        const d = await describeItem(item.photo, item.backgroundRemoved, { category: item.category, colors: item.colors });
        await updateItem(item.id, {
          name: d.name, category: d.category, colors: d.colors, autoNamed: true,
          seasons: item.seasons.length ? item.seasons : defaultSeasons(d.category)
        });
      } catch (e) {
        console.warn('Auto-name failed for', item.id, e);
      }
    }
    setProgress(null);
    refresh();
  }

  return (
    <main>
      <h1>Closet</h1>
      <AddItem onAdded={item => { refresh(); setEditing(item); }} />
      {unnamed.length > 0 && (
        <button className="chip" disabled={!!progress} onClick={autoNameAll}>
          {progress ?? `Auto-name ${unnamed.length} untagged item${unnamed.length > 1 ? 's' : ''}`}
        </button>
      )}
      <div className="chips filter">
        {(['all', ...CATEGORIES] as const).map(c => (
          <button key={c} className={filter === c ? 'chip on' : 'chip'} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>
      <ClosetGrid items={shown} onSelect={setEditing} />
      {editing && <ItemEditor key={editing.id} item={editing} onClose={() => { setEditing(null); refresh(); }} />}
    </main>
  );
}
