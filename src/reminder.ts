const KEY = 'closet:lastBackup';

export function getLastBackup(): Date | null {
  try {
    const raw = localStorage.getItem(KEY);
    const t = raw ? Date.parse(raw) : NaN;
    return Number.isNaN(t) ? null : new Date(t);
  } catch { return null; }
}

export function setLastBackup(d = new Date()): void {
  try { localStorage.setItem(KEY, d.toISOString()); } catch { /* storage unavailable */ }
}

/** Nudge to back up: 30+ days since the last one, or never backed up once there are 5+ items. */
export function backupDue(last: Date | null, itemCount: number, now = new Date(), days = 30): boolean {
  if (itemCount === 0) return false;
  if (!last) return itemCount >= 5;
  return now.getTime() - last.getTime() >= days * 86_400_000;
}
