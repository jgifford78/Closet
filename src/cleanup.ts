export interface Box { x: number; y: number; w: number; h: number }

/**
 * Keep the main object of a cutout: the largest connected region of opaque pixels,
 * plus any region at least `minShare` of its size (e.g. the second shoe of a pair).
 * Everything else (stray text, price tags, carousel dots) is made transparent.
 * Mutates `rgba`; returns the bounding box of what was kept, or null if nothing is opaque.
 */
export function keepMainObject(
  rgba: Uint8ClampedArray, width: number, height: number, minShare = 0.15, alphaCutoff = 128
): Box | null {
  const n = width * height;
  const label = new Int32Array(n); // 0 = unvisited/transparent
  const queue = new Int32Array(n);
  const sizes: number[] = [0]; // sizes[label]
  let next = 0;

  for (let start = 0; start < n; start++) {
    if (label[start] || rgba[start * 4 + 3] < alphaCutoff) continue;
    next++;
    let head = 0, tail = 0, size = 0;
    queue[tail++] = start;
    label[start] = next;
    while (head < tail) {
      const p = queue[head++];
      size++;
      const x = p % width, y = (p / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width || (!dx && !dy)) continue;
          const q = ny * width + nx;
          if (!label[q] && rgba[q * 4 + 3] >= alphaCutoff) {
            label[q] = next;
            queue[tail++] = q;
          }
        }
      }
    }
    sizes.push(size);
  }
  if (!next) return null;

  const largest = Math.max(...sizes);
  const keep = sizes.map(s => s >= largest * minShare);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let p = 0; p < n; p++) {
    const l = label[p];
    if (l && keep[l]) {
      const x = p % width, y = (p / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else {
      rgba[p * 4 + 3] = 0; // drop clutter and faint halo pixels
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
