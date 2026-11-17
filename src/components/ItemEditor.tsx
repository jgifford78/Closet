import { useState } from 'react';
import {
  CATEGORIES, FORMALITIES, SEASONS, deleteItem, updateItem,
  type Category, type ClosetItem, type Formality, type Season
} from '../db';
import { BlobImage } from './BlobImage';
import { Cropper } from './Cropper';
import { defaultName, defaultSeasons } from '../classify';
import { describeItem } from '../describe';
import { cleanCutout, downscale, extractColors, type CropFraction } from '../image';
import { COLOR_HEX, COLOR_NAMES, type ColorName } from '../colors';

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter(x => x !== v) : [...list, v];
}

export function ItemEditor({ item, onClose }: { item: ClosetItem; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [autoNamed, setAutoNamed] = useState(item.autoNamed);
  const [category, setCategory] = useState<Category | null>(item.category);
  const [colors, setColors] = useState<ColorName[]>(item.colors);
  const [seasons, setSeasons] = useState<Season[]>(item.seasons);
  const [formality, setFormality] = useState<Formality | null>(item.formality);
  const [photo, setPhoto] = useState<Blob>(item.photo);
  const [photoRev, setPhotoRev] = useState(0); // local, forces preview refresh after a crop
  const [colorsTouched, setColorsTouched] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /** While the name is generated, keep it in sync with category/color edits. */
  function rename(nextCategory: Category | null, nextColors: ColorName[]) {
    if (autoNamed) setName(defaultName(nextCategory, nextColors));
  }
  function pickCategory(c: Category | null) { setCategory(c); rename(c, colors); }
  function pickColors(c: ColorName[]) { setColors(c); setColorsTouched(true); rename(category, c); }

  async function autoName() {
    setBusy('Detecting…');
    try {
      const d = await describeItem(photo, item.backgroundRemoved, { category, colors });
      setName(d.name);
      setAutoNamed(true);
      if (!category && d.category) {
        setCategory(d.category);
        if (!seasons.length) setSeasons(defaultSeasons(d.category));
      }
      if (!colors.length) setColors(d.colors);
    } finally {
      setBusy(null);
    }
  }

  async function applyCrop(crop?: CropFraction) {
    setCropping(false);
    if (!crop) return;
    setBusy('Cropping…');
    try {
      // Stored photo is already processed; keep PNG when it has transparency.
      let next = await downscale(photo, 1024, item.backgroundRemoved ? 'image/png' : 'image/jpeg', crop);
      if (item.backgroundRemoved) next = await cleanCutout(next).catch(() => next);
      setPhoto(next);
      setPhotoRev(r => r + 1);
      if (!colorsTouched) {
        const fresh = await extractColors(next, item.backgroundRemoved).catch(() => []);
        if (fresh.length) { setColors(fresh); rename(category, fresh); }
      }
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    await updateItem(item.id, {
      name: name.trim() || 'Untitled', category, colors, seasons, formality, autoNamed,
      ...(photo !== item.photo ? { photo } : {})
    });
    onClose();
  }

  return (
    <>
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <BlobImage className="preview" id={`${item.id}:${item.photoRev}:${photoRev}`} blob={photo} alt={name} />
        <div className="chips">
          <button className="chip" disabled={!!busy} onClick={() => setCropping(true)}>Crop photo</button>
          <button className="chip" disabled={!!busy} onClick={autoName}>{busy ?? 'Auto-name'}</button>
        </div>
        <label className="field">
          Name
          <input value={name} onChange={e => { setName(e.target.value); setAutoNamed(false); }} />
        </label>

        <div className="field">Category</div>
        <div className="chips">
          {CATEGORIES.map(c => (
            <button key={c} className={category === c ? 'chip on' : 'chip'} onClick={() => pickCategory(category === c ? null : c)}>{c}</button>
          ))}
        </div>

        <div className="field">Colors <small>(first = main)</small></div>
        <div className="chips">
          {COLOR_NAMES.map(c => (
            <button key={c} className={colors.includes(c) ? 'chip on' : 'chip'} onClick={() => pickColors(toggle(colors, c))}>
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
    {/* Sibling, not child: clicks inside the cropper must not bubble to the editor backdrop. */}
    {cropping && <Cropper file={photo} onCancel={() => setCropping(false)} onDone={applyCrop} />}
    </>
  );
}
