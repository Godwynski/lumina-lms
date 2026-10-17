import { AdminTableShell } from '@/components/admin/AdminTableShell';
import { BookDetailSkeleton } from './page';

export default function Loading() {
  return (
    <AdminTableShell 
      title="Resource Explorer" 
      description="Detailed catalog entry, availability status, and location info."
    >
      <BookDetailSkeleton />
    </AdminTableShell>
  );
}
