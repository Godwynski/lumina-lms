export const CATALOG_PAGE_SIZES = [12, 24, 48];
export const DEFAULT_CATALOG_PAGE_SIZE = 24;

export function getCatalogPageSize(value: string | null | undefined): number {
  return CATALOG_PAGE_SIZES.find((size) => String(size) === value) ?? DEFAULT_CATALOG_PAGE_SIZE;
}
