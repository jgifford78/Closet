import { useRef, useState } from 'react';
import { addItem } from '../db';
import { downscale, extractColors, flattenOnWhite, removeBackground } from '../image';
import { classifyItem, defaultName, defaultSeasons } from '../classify';
import type { Category, ClosetItem } from '../db';

export function AddItem({ onAdded }: { onAdded: (item: ClosetItem) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [autoType, setAutoType] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(file: File) {
    try {
      setStatus('Preparing photo…');
      const small = await downscale(file);
      let photo: Blob = small;
      let backgroundRemoved = false;
      if (removeBg) {
        try {
          setStatus('Removing background… (first time downloads a model)');
          photo = await removeBackground(small);
          backgroundRemoved = true;
        } catch (e) {
          console.warn('Background removal failed, keeping original', e);
          setStatus('Background removal failed; saving original…');
        }
      }
      setStatus('Detecting colors…');
      const colors = await extractColors(photo, backgroundRemoved).catch(() => []);
      let category: Category | null = null;
      let type: string | null = null;
      if (autoType) {
        setStatus('Identifying item… (first time downloads a model)');
        const url = URL.createObjectURL(await flattenOnWhite(photo));
        try {
          ({ category, type } = await classifyItem(url));
        } catch (e) {
          console.warn('Category detection failed; leaving blank', e);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const item = await addItem({
        name: defaultName(category, colors, type),
        autoNamed: true,
        photo, backgroundRemoved, colors, category, seasons: defaultSeasons(category)
      });
      onAdded(item);
    } catch (e) {
      alert(`Could not add item: ${(e as Error).message}`);
    } finally {
      setStatus(null);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="add">
      <label className="check">
        <input type="checkbox" checked={removeBg} onChange={e => setRemoveBg(e.target.checked)} />
        Remove background
      </label>
      <label className="check">
        <input type="checkbox" checked={autoType} onChange={e => setAutoType(e.target.checked)} />
        Auto-detect type
      </label>
      {/* No "capture" attribute: iOS then offers Take Photo / Photo Library. */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button className="primary" disabled={!!status} onClick={() => input.current?.click()}>
        {status ?? '+ Add item'}
      </button>
    </div>
  );
}
