import { describe, expect, it } from 'vitest';
import { filterItems } from './filters';
import { backupDue } from './reminder';
import { daysAgoLabel } from './format';

const items = [
  { name: 'Navy Pants', category: 'bottom' as const, colors: ['navy' as const] },
  { name: 'White Shirt', category: 'top' as const, colors: ['white' as const, 'blue' as const] },
  { name: 'New item', category: null, colors: [] }
];

describe('filterItems', () => {
  const base = { category: 'all' as const, color: null, query: '' };
  it('filters by category, untagged, color (any) and name', () => {
    expect(filterItems(items, base)).toHaveLength(3);
    expect(filterItems(items, { ...base, category: 'top' }).map(i => i.name)).toEqual(['White Shirt']);
    expect(filterItems(items, { ...base, category: 'untagged' }).map(i => i.name)).toEqual(['New item']);
    expect(filterItems(items, { ...base, color: 'blue' }).map(i => i.name)).toEqual(['White Shirt']);
    expect(filterItems(items, { ...base, query: '  PANTS ' }).map(i => i.name)).toEqual(['Navy Pants']);
    expect(filterItems(items, { category: 'top', color: 'navy', query: '' })).toEqual([]);
  });
});

describe('backupDue', () => {
  const now = new Date('2026-11-18T00:00:00Z');
  it('nudges after 30 days, or when never backed up with 5+ items', () => {
    expect(backupDue(null, 0, now)).toBe(false);
    expect(backupDue(null, 4, now)).toBe(false);
    expect(backupDue(null, 5, now)).toBe(true);
    expect(backupDue(new Date('2026-11-01T00:00:00Z'), 50, now)).toBe(false);
    expect(backupDue(new Date('2026-10-18T00:00:00Z'), 50, now)).toBe(true);
    expect(backupDue(new Date('2026-01-01T00:00:00Z'), 0, now)).toBe(false);
  });
});

describe('daysAgoLabel', () => {
  const now = Date.UTC(2026, 10, 18, 12);
  const d = 86_400_000;
  it('reads naturally', () => {
    expect(daysAgoLabel(now - 3600_000, now)).toBe('today');
    expect(daysAgoLabel(now - d, now)).toBe('yesterday');
    expect(daysAgoLabel(now - 5 * d, now)).toBe('5 days ago');
    expect(daysAgoLabel(now - 21 * d, now)).toBe('3 weeks ago');
    expect(daysAgoLabel(now - 90 * d, now)).toBe('3 months ago');
  });
});
