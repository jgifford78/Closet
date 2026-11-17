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
