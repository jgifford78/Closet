/** Downscale a photo so the longest side is <= maxSide; returns a JPEG/PNG blob. */
export async function downscale(file: Blob, maxSide = 1024, type: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
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
