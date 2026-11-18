import type { Category } from './db';
import type { ColorName } from './colors';

export type CategoryFilter = Category | 'all' | 'untagged';

export interface Filter { category: CategoryFilter; color: ColorName | null; query: string }

export function filterItems<T extends { name: string; category: Category | null; colors: ColorName[] }>(items: T[], f: Filter): T[] {
  const q = f.query.trim().toLowerCase();
  return items.filter(i =>
    (f.category === 'all' || (f.category === 'untagged' ? i.category === null : i.category === f.category)) &&
    (!f.color || i.colors.includes(f.color)) &&
    (!q || i.name.toLowerCase().includes(q))
  );
}
