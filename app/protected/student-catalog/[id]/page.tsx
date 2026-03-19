'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getPublicBookById, reportMissingBook } from '@/lib/actions/public-catalog';
import { 
  ChevronLeft, 
  MapPin, 
  AlertCircle, 
  BookOpen, 
  Hash, 
  Tag,
  CheckCircle2,
  Clock,
  BookMarked,
  ScanLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Book } from '@/lib/types';

type StudentBook = Book & {
  section?: string | null;
  tags?: string[];
};

export default function StudentBookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [book, setBook] = useState<StudentBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    async function loadBook() {
      try {
        const data = await getPublicBookById(id);
        setBook(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadBook();
  }, [id]);

  const handleReportMissing = async () => {
    setReportSubmitting(true);
    try {
      await reportMissingBook(id, 'Student reported book missing from shelf.');
      setReported(true);
    } catch (err) {
      console.error(err);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 text-sm font-medium">Loading book details...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
          <BookOpen className="w-8 h-8 text-zinc-300" />
        </div>
        <p className="text-zinc-500 font-medium">Book not found.</p>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <button 
        onClick={() => router.back()}
        className="flex items-center text-zinc-500 hover:text-indigo-600 transition-colors font-medium text-sm group"
      >
        <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
        Back to Catalog
      </button>

      <div className="bg-white rounded-[32px] shadow-sm border border-zinc-200/50 p-6 md:p-10 flex flex-col md:flex-row gap-10">
        {/* Left Side: Cover */}
        <div className="w-full md:w-2/5 flex-shrink-0">
          <div className="aspect-[3/4] bg-zinc-50 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-zinc-100 relative group">
            {book.cover_url ? (
              <Image
                src={book.cover_url}
                alt={book.title}
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <BookOpen className="w-20 h-20 text-zinc-200" />
            )}
             <div className="absolute top-4 right-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5 ${
                  book.available_copies > 0 ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                }`}>
                  {book.available_copies > 0 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      In Library
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" />
                      Borrowed
                    </>
                  )}
                </span>
             </div>
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="flex-1 space-y-8 pt-2">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2 leading-tight tracking-tight">{book.title}</h1>
            <p className="text-xl text-zinc-500 font-medium">{book.author}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {book.section && (
              <span className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold flex items-center border border-indigo-100/50">
                <MapPin className="w-3.5 h-3.5 mr-2" />
                {book.section}
              </span>
            )}
            <span className="bg-zinc-50 text-zinc-600 px-4 py-1.5 rounded-full text-xs font-bold border border-zinc-100">
               {book.available_copies} of {book.total_copies} Available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Hash className="w-3 h-3" />
                ISBN
              </span>
              <p className="text-sm font-bold text-zinc-700 font-mono tracking-tight">{book.isbn || 'Unknown'}</p>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                Category
              </span>
              <p className="text-sm font-bold text-zinc-700">
                {Array.isArray(book.categories)
                  ? book.categories[0]?.name || 'Uncategorized'
                  : book.categories?.name || 'Uncategorized'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1 flex items-center gap-1.5">
                <BookMarked className="h-3 w-3" />
                Smart Tip
              </p>
              <p className="text-xs text-indigo-800 leading-relaxed">
                Use the section tag to go directly to the correct aisle before checking nearby shelves.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1.5">
                <ScanLine className="h-3 w-3" />
                Desk Assist
              </p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                If unavailable, ask staff to scan a copy QR for live return status updates.
              </p>
            </div>
          </div>

          {book.tags && book.tags.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Subject Tags</h3>
              <div className="flex flex-wrap gap-2">
                {book.tags.map((tag: string, i: number) => (
                  <span key={i} className="bg-white text-zinc-600 px-3 py-1 rounded-lg text-xs font-medium border border-zinc-200 shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6">
            {!reported ? (
              <Button
                onClick={handleReportMissing}
                disabled={reportSubmitting || book.available_copies === 0}
                className="w-full h-14 bg-white hover:bg-orange-50 border border-orange-200 text-orange-700 rounded-2xl transition-all shadow-sm shadow-orange-100 group flex items-center justify-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                   <AlertCircle className="w-4 h-4 text-orange-600" />
                </div>
                <span className="font-bold text-sm">
                  {reportSubmitting ? 'Sending Alert...' : "I can't find this book on the shelf"}
                </span>
              </Button>
            ) : (
              <div className="bg-green-50 text-green-800 p-6 rounded-2xl flex flex-col items-center text-center gap-2 border border-green-200 animate-in zoom-in duration-300">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-1">
                   <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-bold">Librarian Notified</p>
                <p className="text-xs opacity-80">{"Thank you! We've added this to our queue to verify the shelf location."}</p>
              </div>
            )}
            {book.available_copies === 0 && !reported && (
              <p className="text-[11px] text-center text-zinc-400 mt-4 leading-relaxed italic">
                This book is currently checked out to another student. Please check back later.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
