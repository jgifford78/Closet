import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FORMALITIES, SEASONS, lastWornMap, listSavedOutfits, listWorn, logWorn, outfitKey, saveOutfit, unsaveOutfit,
  type ClosetItem, type Formality, type Season, type WornEntry
} from '../db';
import { explainEmpty, generateOutfits } from '../outfits';
import { BlobImage } from './BlobImage';
import { ClosetGrid } from './ClosetGrid';

const ORDER = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'accessory'];

function OutfitCard({ items, saved, worn, onToggleSave, onWear }: {
  items: ClosetItem[]; saved: boolean; worn: boolean; onToggleSave: () => void; onWear: () => void;
}) {
  return (
    <article className="outfit">
      <ul>
        {[...items].sort((a, b) => ORDER.indexOf(a.category!) - ORDER.indexOf(b.category!)).map(i => (
          <li key={i.id}>
            <BlobImage id={`${i.id}:${i.photoRev}`} blob={i.photo} alt={i.name} />
            <span className="label">{i.name}</span>
          </li>
        ))}
      </ul>
      <div className="outfit-actions">
        <button className={saved ? 'chip on' : 'chip'} onClick={onToggleSave}>{saved ? '♥ Saved' : '♡ Save'}</button>
        <button className="chip" disabled={worn} onClick={onWear}>{worn ? 'Logged ✓' : 'I wore this'}</button>
      </div>
    </article>
  );
}

export function Outfits({ items }: { items: ClosetItem[] }) {
  const [view, setView] = useState<'generate' | 'saved'>('generate');
  const [season, setSeason] = useState<Season | null>(null); // null = any season until the user picks one
  const [formality, setFormality] = useState<Formality | null>(null);
  const [anchor, setAnchor] = useState<ClosetItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [seed, setSeed] = useState(1);
  const [savedIds, setSavedIds] = useState<string[][]>([]);
  const [worn, setWorn] = useState<WornEntry[]>([]);
  const [justWorn, setJustWorn] = useState<Set<string>>(new Set());
  const [wornReady, setWornReady] = useState(false);

  const reload = useCallback(async () => {
    setSavedIds((await listSavedOutfits()).map(o => o.itemIds));
    setWorn(await listWorn());
    setWornReady(true);
  }, []);
  useEffect(() => void reload(), [reload, items]);

  // Held in a ref so logging a wear doesn't reshuffle what's on screen; it applies to the next draw.
  const lastWorn = useRef<Record<string, number>>({});
  lastWorn.current = lastWornMap(worn);
  const savedKeys = useMemo(() => new Set(savedIds.map(outfitKey)), [savedIds]);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const opts = { season, formality, anchorId: anchor?.id ?? null };
  // `seed` only forces a fresh random draw when Shuffle is pressed.
  const outfits = useMemo(() => generateOutfits(items, { ...opts, lastWorn: lastWorn.current }), [items, season, formality, anchor, seed, wornReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const untagged = items.filter(i => !i.category).length;

  async function toggleSave(ids: string[]) {
    if (savedKeys.has(outfitKey(ids))) await unsaveOutfit(outfitKey(ids)); else await saveOutfit(ids);
    await reload();
  }
  async function wear(ids: string[]) {
    await logWorn(ids);
    setJustWorn(prev => new Set(prev).add(outfitKey(ids)));
    setWorn(await listWorn());
  }

  const savedOutfits = savedIds
    .map(ids => ids.map(id => byId.get(id)).filter((i): i is ClosetItem => !!i))
    .filter((its, n) => its.length === savedIds[n].length);

  return (
    <section>
      <div className="chips">
        <button className={view === 'generate' ? 'chip on' : 'chip'} onClick={() => setView('generate')}>Ideas</button>
        <button className={view === 'saved' ? 'chip on' : 'chip'} onClick={() => setView('saved')}>Saved ({savedOutfits.length})</button>
      </div>

      {view === 'saved' ? (
        <>
          {!savedOutfits.length && <p className="empty">No saved outfits yet. Tap ♡ Save on an idea you like.</p>}
          {savedOutfits.map(its => {
            const ids = its.map(i => i.id);
            return <OutfitCard key={outfitKey(ids)} items={its} saved worn={justWorn.has(outfitKey(ids))}
              onToggleSave={() => toggleSave(ids)} onWear={() => wear(ids)} />;
          })}
        </>
      ) : (
        <>
          <div className="field">Season</div>
          <div className="chips">
            <button className={season === null ? 'chip on' : 'chip'} onClick={() => setSeason(null)}>any</button>
            {SEASONS.map(s => <button key={s} className={season === s ? 'chip on' : 'chip'} onClick={() => setSeason(s)}>{s}</button>)}
          </div>
          <div className="field">Occasion</div>
          <div className="chips">
            <button className={formality === null ? 'chip on' : 'chip'} onClick={() => setFormality(null)}>any</button>
            {FORMALITIES.map(f => <button key={f} className={formality === f ? 'chip on' : 'chip'} onClick={() => setFormality(f)}>{f}</button>)}
          </div>

          <div className="add">
            {anchor
              ? <button className="chip on" onClick={() => setAnchor(null)}>Around: {anchor.name} ×</button>
              : <button className="chip" onClick={() => setPicking(true)}>Build around an item…</button>}
            <button className="primary" onClick={() => setSeed(s => s + 1)}>Shuffle</button>
          </div>

          {untagged > 0 && <p className="hint">{untagged} item{untagged > 1 ? 's are' : ' is'} untagged and skipped.</p>}
          {items.some(i => i.category === 'accessory' && !i.accessoryType) && <p className="hint">Some accessories have no type yet. Open them and pick hat, belt, watch… so the right matching rules apply.</p>}
          {!items.some(i => i.category === 'accessory') && items.length > 0 && <p className="hint">No accessories yet. Set an item’s category to accessory (hat, belt, bag, scarf…) to include it in outfits.</p>}
          {!outfits.length && <p className="empty">{explainEmpty(items, opts)}</p>}

          {outfits.map(o => {
            const ids = o.items.map(i => i.id);
            const key = outfitKey(ids);
            return <OutfitCard key={key} items={o.items} saved={savedKeys.has(key)} worn={justWorn.has(key)}
              onToggleSave={() => toggleSave(ids)} onWear={() => wear(ids)} />;
          })}
        </>
      )}

      {picking && (
        <div className="sheet-backdrop" onClick={() => setPicking(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <p className="hint">Pick the piece to build around.</p>
            <ClosetGrid items={items.filter(i => i.category)} onSelect={i => { setAnchor(i); setPicking(false); }} />
          </div>
        </div>
      )}
    </section>
  );
}
