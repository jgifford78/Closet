import { useEffect, useMemo } from 'react';
import { deleteItem, type ClosetItem } from '../db';

export function ClosetGrid({ items, onChanged }: { items: ClosetItem[]; onChanged: () => void }) {
  const urls = useMemo(() => items.map(i => URL.createObjectURL(i.photo)), [items]);
  useEffect(() => () => urls.forEach(URL.revokeObjectURL), [urls]);

  if (!items.length) return <p className="empty">No items yet. Tap “Add item” to photograph your first piece.</p>;

  return (
    <ul className="grid">
      {items.map((item, i) => (
        <li key={item.id}>
          <img src={urls[i]} alt={item.name} />
          <button
            className="del"
            aria-label={`Delete ${item.name}`}
            onClick={async () => {
              if (confirm('Delete this item?')) {
                await deleteItem(item.id);
                onChanged();
              }
            }}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
