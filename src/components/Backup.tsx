import { useRef, useState } from 'react';
import { createBackup, restoreBackup } from '../backup';

const KEY = 'closet:lastBackup';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* storage unavailable */ } };

export function Backup({ onRestored }: { onRestored: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(read());

  async function exportAll() {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await createBackup();
      const name = `closet-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Closet backup' });
        } catch (e) {
          if ((e as Error).name === 'AbortError') return; // user closed the share sheet
          throw e;
        }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      }
      const now = new Date().toLocaleString();
      write(now);
      setLast(now);
      setMsg('Backup created. Save it to Files or iCloud Drive.');
    } catch (e) {
      setMsg(`Backup failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await restoreBackup(file);
      setMsg(`Restored ${r.items} item${r.items === 1 ? '' : 's'}, ${r.outfits} saved outfit${r.outfits === 1 ? '' : 's'}. Anything already here was kept.`);
      onRestored();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section>
      <p className="hint">Your closet lives only on this phone. Export a backup now and then, and before switching phones.</p>
      <p className="hint">{last ? `Last backup: ${last}` : 'No backup yet on this phone.'}</p>
      <div className="add">
        <button className="primary" disabled={busy} onClick={exportAll}>Export backup</button>
        <button className="chip" disabled={busy} onClick={() => input.current?.click()}>Import backup…</button>
      </div>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} />
      {msg && <p>{msg}</p>}
    </section>
  );
}
