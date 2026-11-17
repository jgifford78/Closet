import type { ClosetItem } from '../db';
import { COLOR_HEX } from '../colors';
import { BlobImage } from './BlobImage';

export function ClosetGrid({ items, onSelect }: { items: ClosetItem[]; onSelect: (item: ClosetItem) => void }) {
  if (!items.length) return <p className="empty">Nothing here yet. Tap “Add item” to photograph a piece.</p>;

  return (
    <ul className="grid">
      {items.map(item => (
        <li key={item.id} onClick={() => onSelect(item)}>
          <BlobImage id={item.id} blob={item.photo} alt={item.name} />
          {!item.category && <span className="untagged">Untagged</span>}
          <span className="label">{item.name}</span>
          <span className="dots">
            {item.colors.map(c => <span key={c} className="dot" style={{ background: COLOR_HEX[c] }} title={c} />)}
          </span>
        </li>
      ))}
    </ul>
  );
}
