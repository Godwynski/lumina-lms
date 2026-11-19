const BOOK_SORTS = {
  relevance: { label: 'Best Match', sortBy: 'relevance', sortOrder: 'asc' },
  newest: { label: 'Recently Added', sortBy: 'created_at', sortOrder: 'desc' },
  title_asc: { label: 'Title A-Z', sortBy: 'title', sortOrder: 'asc' },
  title_desc: { label: 'Title Z-A', sortBy: 'title', sortOrder: 'desc' },
  author_asc: { label: 'Author A-Z', sortBy: 'author', sortOrder: 'asc' },
  author_desc: { label: 'Author Z-A', sortBy: 'author', sortOrder: 'desc' },
  availability_desc: { label: 'Most Available', sortBy: 'availability', sortOrder: 'desc' },
  availability_asc: { label: 'Least Available', sortBy: 'availability', sortOrder: 'asc' },
} as const;

const LEGACY_BOOK_SORTS = { title: 'title_asc', author: 'author_asc', availability: 'availability_desc' } as const;

export type BookSort = keyof typeof BOOK_SORTS;
export type BookSortParam = BookSort | keyof typeof LEGACY_BOOK_SORTS;
export type BookSortColumn = 'title' | 'author' | 'availability';

export const BOOK_SORT_OPTIONS = Object.entries(BOOK_SORTS).map(([value, sort]) => ({ value, label: sort.label }));

export function parseBookSort(value: string | null | undefined, hasQuery: boolean): BookSortParam | undefined {
  if (typeof value !== 'string' || (value === 'relevance' && !hasQuery)) return undefined;
  return Object.hasOwn(BOOK_SORTS, value) || Object.hasOwn(LEGACY_BOOK_SORTS, value)
    ? value as BookSortParam
    : undefined;
}

export function normalizeBookSort(sort: BookSortParam): BookSort {
  return Object.hasOwn(LEGACY_BOOK_SORTS, sort) ? LEGACY_BOOK_SORTS[sort as keyof typeof LEGACY_BOOK_SORTS] : sort as BookSort;
}

export function getBookOrdering(sort: string, hasQuery: boolean) {
  const { sortBy, sortOrder } = BOOK_SORTS[normalizeBookSort(parseBookSort(sort, hasQuery) ?? 'title_asc')];
  return { sortBy, sortOrder };
}

export function bookColumnSort(sort: BookSort, column: BookSortColumn, onChange: (next: BookSort) => void) {
  const active = BOOK_SORTS[sort];
  const direction = active.sortBy === column ? active.sortOrder : undefined;
  const nextDirection = direction === 'asc' || (direction === undefined && column === 'availability') ? 'desc' : 'asc';
  return { direction, onToggle: () => onChange(`${column}_${nextDirection}`) };
}
