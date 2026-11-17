import { useCallback, useEffect, useState } from 'react';
import { listItems, type ClosetItem } from './db';
import { AddItem } from './components/AddItem';
import { ClosetGrid } from './components/ClosetGrid';

export function App() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const refresh = useCallback(() => listItems().then(setItems), []);
  useEffect(() => void refresh(), [refresh]);

  return (
    <main>
      <h1>Closet</h1>
      <AddItem onAdded={refresh} />
      <ClosetGrid items={items} onChanged={refresh} />
    </main>
  );
}
