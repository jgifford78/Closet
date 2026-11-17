/** Downscale a photo so the longest side is <= maxSide; returns a JPEG/PNG blob. */
export interface CropFraction { x: number; y: number; w: number; h: number } // 0..1 of the oriented image

export async function downscale(
  file: Blob, maxSide = 1024, type: 'image/jpeg' | 'image/png' = 'image/jpeg', crop?: CropFraction
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const sx = crop ? Math.round(crop.x * bitmap.width) : 0;
  const sy = crop ? Math.round(crop.y * bitmap.height) : 0;
  const sw = crop ? Math.max(1, Math.round(crop.w * bitmap.width)) : bitmap.width;
  const sh = crop ? Math.max(1, Math.round(crop.h * bitmap.height)) : bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image encode failed'))), type, 0.88)
  );
}

/** Remove the background in-browser. Model downloads on first use, then is cached. */
export async function removeBackground(photo: Blob): Promise<Blob> {
  const { removeBackground: run } = await import('@imgly/background-removal');
  return run(photo, { output: { format: 'image/png' } });
}

/** Read pixels and return dominant color names. Without transparency, only the central area is sampled. */
export async function extractColors(photo: Blob, hasAlpha: boolean): Promise<import('./colors').ColorName[]> {
  const { dominantColors } = await import('./colors');
  const bitmap = await createImageBitmap(photo);
  const size = 96;
  const scale = size / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  if (hasAlpha) return dominantColors(ctx.getImageData(0, 0, w, h).data);
  const [x, y, cw, ch] = [Math.round(w * 0.25), Math.round(h * 0.25), Math.round(w * 0.5), Math.round(h * 0.5)];
  return dominantColors(ctx.getImageData(x, y, Math.max(1, cw), Math.max(1, ch)).data);
}

/** Composite a (possibly transparent) photo onto white so the classifier sees a normal picture. */
export async function flattenOnWhite(photo: Blob, size = 224): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/png')
  );
}

/** Drop stray clutter from a cutout (text, price tags, carousel dots) and trim empty edges. */
export async function cleanCutout(photo: Blob): Promise<Blob> {
  const { keepMainObject } = await import('./cleanup');
  const bitmap = await createImageBitmap(photo);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const box = keepMainObject(img.data, img.width, img.height);
  if (!box) return photo;
  ctx.putImageData(img, 0, 0);
  const pad = 8;
  const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
  const w = Math.min(canvas.width - x, box.w + pad * 2), h = Math.min(canvas.height - y, box.h + pad * 2);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    out.toBlob(b => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/png')
  );
}
