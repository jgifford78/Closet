import { useRef, useState } from 'react';
import { addItem } from '../db';
import { cleanCutout, downscale, extractColors, flattenOnWhite, opaqueShare, removeBackground, type CropFraction } from '../image';
import { Cropper } from './Cropper';
import { classifyItem, defaultName, defaultSeasons } from '../classify';
import type { Category, ClosetItem } from '../db';

export function AddItem({ onAdded }: { onAdded: (item: ClosetItem) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [autoType, setAutoType] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleFile(file: File, crop?: CropFraction) {
    try {
      setNotice(null);
      setStatus('Preparing photo…');
      const small = await downscale(file, 1024, 'image/jpeg', crop);
      let photo: Blob = small;
      let backgroundRemoved = false;
      if (removeBg) {
        try {
          setStatus('Removing background… (first time downloads a model)');
          photo = await removeBackground(small);
          backgroundRemoved = true;
          photo = await cleanCutout(photo).catch(() => photo);
          if ((await opaqueShare(photo).catch(() => 0)) > 0.85)
            setNotice('Most of the picture was kept, so the background may not have come off. Open the item, tap Crop photo around it, then Remove background.');
        } catch (e) {
          console.warn('Background removal failed, keeping original', e);
          setNotice(`Background removal didn't run (${(e as Error).message || 'unknown error'}). The original photo was saved. Open the item and tap Remove background to retry.`);
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
    <div className="add add-item">
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
        onChange={e => e.target.files?.[0] && setPending(e.target.files[0])}
      />
      {pending && (
        <Cropper
          file={pending}
          onCancel={() => { setPending(null); if (input.current) input.current.value = ''; }}
          onDone={crop => { const f = pending; setPending(null); void handleFile(f, crop); }}
        />
      )}
      {notice && <p className="nudge" onClick={() => setNotice(null)}>{notice}</p>}
      <button className="primary" disabled={!!status} onClick={() => input.current?.click()}>
        {status ?? '+ Add item'}
      </button>
    </div>
  );
}
