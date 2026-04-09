import { getBookById, getBookCopies } from '@/lib/actions/catalog';
import { StaffBookManagementClient } from './StaffBookManagementClient';
import type { Book, BookCopy } from '@/lib/types';

export default async function StaffBookManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  let book: Book | null = null;
  let copies: BookCopy[] = [];
  
  try {
    const [bookData, copiesData] = await Promise.all([
      getBookById(id),
      getBookCopies(id)
    ]);
    book = bookData;
    copies = copiesData;
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
    />
  );
}
