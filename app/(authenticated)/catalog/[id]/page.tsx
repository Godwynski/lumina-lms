import { getBookById, getBookCopies, getBookReservationQueue } from '@/lib/actions/catalog';
import { StaffBookManagementClient } from './StaffBookManagementClient';
import type { Book, BookCopyWithReservation } from '@/lib/types';

export default async function StaffBookManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  let book: Book | null = null;
  let copies: BookCopyWithReservation[] = [];
  let reservationQueue: Awaited<ReturnType<typeof getBookReservationQueue>> = [];
  
  try {
    const [bookData, copiesData, queueData] = await Promise.all([
      getBookById(id),
      getBookCopies(id),
      getBookReservationQueue(id),
    ]);
    book = bookData;
    copies = copiesData as BookCopyWithReservation[];
    reservationQueue = queueData;
  } catch (err) {
    console.error(err);
  }

  if (!book) {
    return <div className="p-12 text-center text-muted-foreground">Book not found.</div>;
  }

  return (
    <StaffBookManagementClient 
      initialBook={book} 
      initialCopies={copies}
      initialReservationQueue={reservationQueue}
    />
  );
}
