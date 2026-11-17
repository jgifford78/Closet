import { useMemo, useState } from 'react';
import { FORMALITIES, SEASONS, type ClosetItem, type Formality, type Season } from '../db';
import { explainEmpty, generateOutfits } from '../outfits';
import { BlobImage } from './BlobImage';
import { ClosetGrid } from './ClosetGrid';

function currentSeason(d = new Date()): Season {
  const m = d.getMonth(); // Northern hemisphere
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'fall' : 'winter';
}

const ORDER = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'accessory'];

export function Outfits({ items }: { items: ClosetItem[] }) {
  const [season, setSeason] = useState<Season | null>(currentSeason());
  const [formality, setFormality] = useState<Formality | null>(null);
  const [anchor, setAnchor] = useState<ClosetItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [seed, setSeed] = useState(1);

  const opts = { season, formality, anchorId: anchor?.id ?? null };
  // `seed` only forces a fresh random draw when Shuffle is pressed.
  const outfits = useMemo(() => generateOutfits(items, opts), [items, season, formality, anchor, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const untagged = items.filter(i => !i.category).length;

  return (
    <section>
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
      {!outfits.length && <p className="empty">{explainEmpty(items, opts)}</p>}

      {outfits.map((o, n) => (
        <article className="outfit" key={o.items.map(i => i.id).join('|') + n}>
          <ul>
            {[...o.items].sort((a, b) => ORDER.indexOf(a.category!) - ORDER.indexOf(b.category!)).map(i => (
              <li key={i.id}>
                <BlobImage id={`${i.id}:${i.photoRev}`} blob={i.photo} alt={i.name} />
                <span className="label">{i.name}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}

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
