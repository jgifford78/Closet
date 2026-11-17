import { useCallback, useEffect, useState } from 'react';
import { CATEGORIES, listItems, type Category, type ClosetItem } from './db';
import { AddItem } from './components/AddItem';
import { ClosetGrid } from './components/ClosetGrid';
import { ItemEditor } from './components/ItemEditor';

export function App() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [editing, setEditing] = useState<ClosetItem | null>(null);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const refresh = useCallback(() => listItems().then(setItems), []);
  useEffect(() => void refresh(), [refresh]);

  const shown = filter === 'all' ? items : items.filter(i => i.category === filter);

  return (
    <main>
      <h1>Closet</h1>
      <AddItem onAdded={item => { refresh(); setEditing(item); }} />
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
