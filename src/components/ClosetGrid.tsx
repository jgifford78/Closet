import { useEffect, useMemo } from 'react';
import type { ClosetItem } from '../db';
import { COLOR_HEX } from '../colors';

export function ClosetGrid({ items, onSelect }: { items: ClosetItem[]; onSelect: (item: ClosetItem) => void }) {
  const urls = useMemo(() => items.map(i => URL.createObjectURL(i.photo)), [items]);
  useEffect(() => () => urls.forEach(URL.revokeObjectURL), [urls]);

  if (!items.length) return <p className="empty">Nothing here yet. Tap “Add item” to photograph a piece.</p>;

  return (
    <ul className="grid">
      {items.map((item, i) => (
        <li key={item.id} onClick={() => onSelect(item)}>
          <img src={urls[i]} alt={item.name} />
          {!item.category && <span className="untagged">Untagged</span>}
          <span className="dots">
            {item.colors.map(c => <span key={c} className="dot" style={{ background: COLOR_HEX[c] }} title={c} />)}
          </span>
        </li>
      ))}
    </ul>
  );
}
