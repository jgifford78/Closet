import { useCallback, useEffect, useState } from 'react';
import { CATEGORIES, listItems, updateItem, type ClosetItem } from './db';
import { AddItem } from './components/AddItem';
import { ClosetGrid } from './components/ClosetGrid';
import { ItemEditor } from './components/ItemEditor';
import { defaultSeasons } from './classify';
import { describeItem } from './describe';
import { Outfits } from './components/Outfits';
import { Backup } from './components/Backup';
import { COLOR_HEX, COLOR_NAMES } from './colors';
import { filterItems, type CategoryFilter } from './filters';
import { backupDue, getLastBackup } from './reminder';
import { requestPersistence } from './storage';

export function App() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [editing, setEditing] = useState<ClosetItem | null>(null);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [color, setColor] = useState<(typeof COLOR_NAMES)[number] | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'closet' | 'outfits' | 'backup'>('closet');
  const [progress, setProgress] = useState<string | null>(null);
  const refresh = useCallback(() => listItems().then(setItems), []);
  useEffect(() => void refresh(), [refresh]);
  useEffect(() => { void requestPersistence(); }, []);

  const shown = filterItems(items, { category, color, query });
  const presentColors = COLOR_NAMES.filter(c => items.some(i => i.colors.includes(c)));
  const showBackupNudge = backupDue(getLastBackup(), items.length);
  // Older items that were never tagged and still have a generated (not typed) name.
  const unnamed = items.filter(i => i.autoNamed && !i.category);

  async function autoNameAll() {
    for (const [n, item] of unnamed.entries()) {
      setProgress(`Auto-naming ${n + 1}/${unnamed.length}…`);
      try {
        const d = await describeItem(item.photo, item.backgroundRemoved, { category: item.category, colors: item.colors });
        await updateItem(item.id, {
          name: d.name, category: d.category, colors: d.colors, autoNamed: true,
          seasons: item.seasons.length ? item.seasons : defaultSeasons(d.category)
        });
      } catch (e) {
        console.warn('Auto-name failed for', item.id, e);
      }
    }
    setProgress(null);
    refresh();
  }

  return (
    <main>
      <h1>Closet</h1>
      <nav className="tabs">
        <button className={tab === 'closet' ? 'tab on' : 'tab'} onClick={() => setTab('closet')}>Closet</button>
        <button className={tab === 'outfits' ? 'tab on' : 'tab'} onClick={() => setTab('outfits')}>Outfits</button>
        <button className={tab === 'backup' ? 'tab on' : 'tab'} onClick={() => setTab('backup')}>Backup</button>
      </nav>
      {tab === 'outfits' ? <Outfits items={items} /> : tab === 'backup' ? <Backup onRestored={refresh} /> : <>
      <AddItem onAdded={item => { refresh(); setEditing(item); }} />
      {unnamed.length > 0 && (
        <button className="chip" disabled={!!progress} onClick={autoNameAll}>
          {progress ?? `Auto-name ${unnamed.length} untagged item${unnamed.length > 1 ? 's' : ''}`}
        </button>
      )}
      {showBackupNudge && (
        <p className="nudge">
          Time for a backup. <button className="link" onClick={() => setTab('backup')}>Go to Backup</button>
        </p>
      )}
      <input className="search" type="search" placeholder="Search by name" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="chips filter">
        {(['all', 'untagged', ...CATEGORIES] as const).map(c => (
          <button key={c} className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>
      {presentColors.length > 1 && (
        <div className="chips filter">
          {presentColors.map(c => (
            <button key={c} className={color === c ? 'chip on' : 'chip'} onClick={() => setColor(color === c ? null : c)}>
              <span className="dot" style={{ background: COLOR_HEX[c] }} />{c}
            </button>
          ))}
        </div>
      )}
      <ClosetGrid items={shown} onSelect={setEditing} />
      </>}
      {editing && <ItemEditor key={editing.id} item={editing} onClose={() => { setEditing(null); refresh(); }} />}
    </main>
  );
}
