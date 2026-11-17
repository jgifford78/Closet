import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORIES, FORMALITIES, SEASONS, deleteItem, updateItem,
  type Category, type ClosetItem, type Formality, type Season
} from '../db';
import { COLOR_HEX, COLOR_NAMES, type ColorName } from '../colors';

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter(x => x !== v) : [...list, v];
}

export function ItemEditor({ item, onClose }: { item: ClosetItem; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<Category | null>(item.category);
  const [colors, setColors] = useState<ColorName[]>(item.colors);
  const [seasons, setSeasons] = useState<Season[]>(item.seasons);
  const [formality, setFormality] = useState<Formality | null>(item.formality);
  const url = useMemo(() => URL.createObjectURL(item.photo), [item.photo]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  async function save() {
    await updateItem(item.id, { name: name.trim() || 'Untitled', category, colors, seasons, formality });
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <img className="preview" src={url} alt={name} />
        <label className="field">
          Name
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>

        <div className="field">Category</div>
        <div className="chips">
          {CATEGORIES.map(c => (
            <button key={c} className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(category === c ? null : c)}>{c}</button>
          ))}
        </div>

        <div className="field">Colors <small>(first = main)</small></div>
        <div className="chips">
          {COLOR_NAMES.map(c => (
            <button key={c} className={colors.includes(c) ? 'chip on' : 'chip'} onClick={() => setColors(toggle(colors, c))}>
              <span className="dot" style={{ background: COLOR_HEX[c] }} />
              {c}
            </button>
          ))}
        </div>

        <div className="field">Seasons</div>
        <div className="chips">
          {SEASONS.map(s => (
            <button key={s} className={seasons.includes(s) ? 'chip on' : 'chip'} onClick={() => setSeasons(toggle(seasons, s))}>{s}</button>
          ))}
        </div>

        <div className="field">Formality</div>
        <div className="chips">
          {FORMALITIES.map(f => (
            <button key={f} className={formality === f ? 'chip on' : 'chip'} onClick={() => setFormality(formality === f ? null : f)}>{f}</button>
          ))}
        </div>

        <div className="actions">
          <button
            className="danger"
            onClick={async () => {
              if (confirm('Delete this item?')) {
                await deleteItem(item.id);
                onClose();
              }
            }}
          >
            Delete
          </button>
          <button className="primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
