import { useEffect, useRef, useState } from 'react';
import type { CropFraction } from '../image';

/** Drag on the picture to box the item (handy for screenshots with page clutter). */
export function Cropper({ file, onDone, onCancel }: {
  file: Blob;
  onDone: (crop?: CropFraction) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState<string>();
  const [sel, setSel] = useState<CropFraction>();
  const wrap = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number }>();

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const point = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    };
  };

  return (
    <div className="sheet-backdrop">
      <div className="sheet">
        <p className="hint">Drag to box the item. Skip cropping if the photo is already clean.</p>
        <div
          ref={wrap}
          className="crop-wrap"
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); start.current = point(e); setSel(undefined); }}
          onPointerMove={e => {
            if (!start.current) return;
            const p = point(e), s = start.current;
            setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
          }}
          onPointerUp={() => { start.current = undefined; }}
        >
          {url && <img src={url} alt="Crop preview" draggable={false} />}
          {sel && <div className="crop-box" style={{ left: `${sel.x * 100}%`, top: `${sel.y * 100}%`, width: `${sel.w * 100}%`, height: `${sel.h * 100}%` }} />}
        </div>
        <div className="actions">
          <button className="danger" onClick={onCancel}>Cancel</button>
          {sel && sel.w > 0.05 && sel.h > 0.05
            ? <button className="primary" onClick={() => onDone(sel)}>Use crop</button>
            : <button className="primary" onClick={() => onDone()}>Skip cropping</button>}
        </div>
      </div>
    </div>
  );
}
