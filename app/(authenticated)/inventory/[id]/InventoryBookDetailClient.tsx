'use client';

import type { ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { AdminManagementContent } from '@/components/catalog/AdminManagementContent';
import { useBookDetailRealtime } from '@/hooks/use-book-detail-realtime';

type InventoryBookDetailProps = Pick<ComponentProps<typeof AdminManagementContent>, 'initialBook' | 'initialCopies' | 'initialQueue'> & {
  canManage: boolean;
};

export function InventoryBookDetailClient({ initialBook, ...props }: InventoryBookDetailProps) {
  const router = useRouter();
  useBookDetailRealtime(initialBook.id, router.refresh);

  return <AdminManagementContent initialBook={initialBook} {...props} onClose={() => router.replace('/inventory')} />;
}
