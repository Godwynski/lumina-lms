import Image from 'next/image';
import Link from 'next/link';
import { getPublicBookById } from '@/lib/actions/public-catalog';
import { ChevronLeft, MapPin, BookOpen, Hash, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportMissingButton } from '@/components/common/ReportMissingButton';

export default async function PublicBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  let book = null;
  try {
    book = await getPublicBookById(id);
  } catch (err) {
    console.error(err);
  }

  if (!book) {
    return <div className="p-8 text-center text-muted-foreground">Book not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Button
        asChild
        variant="ghost"
        className="flex items-center text-muted-foreground hover:text-foreground mb-6 px-0"
      >
        <Link href="/">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Library
        </Link>
      </Button>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8 flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/3 flex-shrink-0">
          <div className="relative aspect-[2/3] bg-muted rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
            {book.cover_url ? (
              <Image 
                src={book.cover_url} 
                alt={book.title} 
                fill
                className="object-cover" 
              />
            ) : (
              <BookOpen className="w-16 h-16 text-muted-foreground/40" />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{book.title}</h1>
            <p className="text-xl text-muted-foreground">{book.author}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {book.available_copies > 0 ? (
              <span className="status-success border px-3 py-1 rounded-full text-sm font-medium">
                {book.available_copies} Available
              </span>
            ) : (
              <span className="status-danger border px-3 py-1 rounded-full text-sm font-medium">
                Currently Borrowed
              </span>
            )}
            
            {(book.section || book.location) && (
              <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                {book.section}{book.section && book.location && ' - '}{book.location}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-y border-border">
            <div className="flex items-center text-sm text-muted-foreground">
              <Hash className="w-4 h-4 mr-2 text-muted-foreground/60" />
              <span className="font-medium mr-2">ISBN:</span>
              {book.isbn || 'Unknown'}
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground">
              <Tag className="w-4 h-4 mr-2 text-muted-foreground/60" />
              <span className="font-medium mr-2">Category:</span>
              {Array.isArray(book.categories) 
                ? book.categories[0]?.name 
                : (book.categories as { name?: string })?.name || 'Uncategorized'}
            </div>
          </div>

          {book.tags && book.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Subject Tags</h3>
              <div className="flex flex-wrap gap-2">
                {book.tags.map((tag: string, i: number) => (
                  <span key={i} className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6">
            <ReportMissingButton
              bookId={id}
              disabled={book.available_copies === 0}
              userType="public"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
