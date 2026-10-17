import { CatalogSkeleton } from "../catalog/CatalogContent";

export default function Loading() {
  return (
    <div className="space-y-4 pb-14 overflow-x-hidden relative">
      <CatalogSkeleton />
    </div>
  );
}
