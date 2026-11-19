import { useEffect, useState } from 'react';
import {
  ACCESSORY_TYPES, CATEGORIES, FORMALITIES, SEASONS, deleteItem, lastWornMap, listWorn, updateItem,
  type AccessoryType, type Category, type ClosetItem, type Formality, type Season
} from '../db';
import { BlobImage } from './BlobImage';
import { Cropper } from './Cropper';
import { ACCESSORY_LABEL, defaultName, defaultSeasons } from '../classify';
import { describeItem } from '../describe';
import { daysAgoLabel } from '../format';
import { cleanCutout, downscale, extractColors, opaqueShare, removeBackground, type CropFraction } from '../image';
import { COLOR_HEX, COLOR_NAMES, type ColorName } from '../colors';

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter(x => x !== v) : [...list, v];
}

export function ItemEditor({ item, onClose }: { item: ClosetItem; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [autoNamed, setAutoNamed] = useState(item.autoNamed);
  const [category, setCategory] = useState<Category | null>(item.category);
  const [accessoryType, setAccessoryType] = useState<AccessoryType | null>(item.accessoryType);
  const [colors, setColors] = useState<ColorName[]>(item.colors);
  const [seasons, setSeasons] = useState<Season[]>(item.seasons);
  const [formality, setFormality] = useState<Formality | null>(item.formality);
  const [photo, setPhoto] = useState<Blob>(item.photo);
  const [photoRev, setPhotoRev] = useState(0); // local, forces preview refresh after a crop
  const [colorsTouched, setColorsTouched] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [bgRemoved, setBgRemoved] = useState(item.backgroundRemoved);
  const [message, setMessage] = useState<string | null>(null);
  const [lastWorn, setLastWorn] = useState<number | null>(null);
  useEffect(() => { void listWorn().then(w => setLastWorn(lastWornMap(w)[item.id] ?? null)); }, [item.id]);

  /** While the name is generated, keep it in sync with category/type/color edits. */
  function rename(nextCategory: Category | null, nextColors: ColorName[], nextType: AccessoryType | null = accessoryType) {
    if (autoNamed) setName(defaultName(nextCategory, nextColors, nextCategory === 'accessory' && nextType ? ACCESSORY_LABEL[nextType] : null));
  }
  function pickCategory(c: Category | null) { setCategory(c); if (c !== 'accessory') setAccessoryType(null); rename(c, colors, c === 'accessory' ? accessoryType : null); }
  function pickAccessoryType(t: AccessoryType | null) { setAccessoryType(t); rename(category, colors, t); }
  function pickColors(c: ColorName[]) { setColors(c); setColorsTouched(true); rename(category, c); }

  async function autoName() {
    setBusy('Detecting…');
    try {
      const d = await describeItem(photo, bgRemoved, { category, accessoryType, colors });
      setName(d.name);
      setAutoNamed(true);
      if (d.accessoryType) setAccessoryType(d.accessoryType);
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
      let next = await downscale(photo, 1024, bgRemoved ? 'image/png' : 'image/jpeg', crop);
      if (bgRemoved) next = await cleanCutout(next).catch(() => next);
      setPhoto(next);
      setPhotoRev(r => r + 1);
      if (!colorsTouched) {
        const fresh = await extractColors(next, bgRemoved).catch(() => []);
        if (fresh.length) { setColors(fresh); rename(category, fresh); }
      }
    } finally {
      setBusy(null);
    }
  }

  async function removeBg() {
    setBusy('Removing background… (first time downloads a model)');
    setMessage(null);
    try {
      let cut = await removeBackground(photo);
      cut = await cleanCutout(cut).catch(() => cut);
      setPhoto(cut);
      setPhotoRev(r => r + 1);
      setBgRemoved(true);
      if (!colorsTouched) {
        const fresh = await extractColors(cut, true).catch(() => []);
        if (fresh.length) { setColors(fresh); rename(category, fresh); }
      }
      if ((await opaqueShare(cut).catch(() => 0)) > 0.85)
        setMessage('Most of the picture was kept. Try Crop photo around the item, then Remove background again.');
    } catch (e) {
      setMessage(`Background removal failed: ${(e as Error).message || 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    await updateItem(item.id, {
      name: name.trim() || 'Untitled', category, accessoryType: category === 'accessory' ? accessoryType : null, colors, seasons, formality, autoNamed,
      ...(photo !== item.photo ? { photo, backgroundRemoved: bgRemoved } : {})
    });
    onClose();
  }

  return (
    <>
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <BlobImage className="preview" id={`${item.id}:${item.photoRev}:${photoRev}`} blob={photo} alt={name} />
        <p className="hint">{lastWorn ? `Last worn ${daysAgoLabel(lastWorn)}` : 'Not worn yet'}</p>
        <div className="chips">
          <button className="chip" disabled={!!busy} onClick={() => setCropping(true)}>Crop photo</button>
          {!bgRemoved && <button className="chip" disabled={!!busy} onClick={removeBg}>Remove background</button>}
          <button className="chip" disabled={!!busy} onClick={autoName}>Auto-name</button>
        </div>
        {busy && <p className="hint">{busy}</p>}
        {message && <p className="nudge">{message}</p>}
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

        {category === 'accessory' && (
          <>
            <div className="field">Accessory type <small>(sets how it's matched)</small></div>
            <div className="chips">
              {ACCESSORY_TYPES.map(t => (
                <button key={t} className={accessoryType === t ? 'chip on' : 'chip'} onClick={() => pickAccessoryType(accessoryType === t ? null : t)}>{ACCESSORY_LABEL[t].toLowerCase()}</button>
              ))}
            </div>
          </>
        )}

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
