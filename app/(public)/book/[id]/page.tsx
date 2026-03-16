'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getBookById } from '@/lib/actions/catalog';
import { reportMissingBook } from '@/lib/actions/public-catalog';
import { ChevronLeft, MapPin, AlertCircle, BookOpen, Hash, Tag } from 'lucide-react';
import { Book } from '@/lib/types';

export default function PublicBookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    async function loadBook() {
      try {
        const data = await getBookById(id);
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
      await reportMissingBook(id, 'User reported book missing from shelf.');
      setReported(true);
    } catch (err) {
      console.error(err);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading book details...</div>;
  }

  if (!book) {
    return <div className="p-8 text-center text-gray-500">Book not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <button 
        onClick={() => router.back()}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="w-5 h-5 mr-1" />
        Back to Search
      </button>

      <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8 flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/3 flex-shrink-0">
          <div className="relative aspect-[2/3] bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
            {book.cover_url ? (
              <Image 
                src={book.cover_url} 
                alt={book.title} 
                fill
                className="object-cover" 
              />
            ) : (
              <BookOpen className="w-16 h-16 text-gray-300" />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{book.title}</h1>
            <p className="text-xl text-gray-600">{book.author}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {book.available_copies > 0 ? (
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                {book.available_copies} Available
              </span>
            ) : (
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                Currently Borrowed
              </span>
            )}
            
            {(book.section || book.location) && (
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                {book.section}{book.section && book.location && ' - '}{book.location}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-y">
            <div className="flex items-center text-sm text-gray-600">
              <Hash className="w-4 h-4 mr-2 text-gray-400" />
              <span className="font-medium mr-2">ISBN:</span>
              {book.isbn || 'Unknown'}
            </div>
            
            <div className="flex items-center text-sm text-gray-600">
              <Tag className="w-4 h-4 mr-2 text-gray-400" />
              <span className="font-medium mr-2">Category:</span>
              {Array.isArray(book.categories) 
                ? book.categories[0]?.name 
                : book.categories?.name || 'Uncategorized'}
            </div>
          </div>

          {book.tags && book.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Subject Tags</h3>
              <div className="flex flex-wrap gap-2">
                {book.tags.map((tag: string, i: number) => (
                  <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6">
            {!reported ? (
              <button
                onClick={handleReportMissing}
                disabled={reportSubmitting || book.available_copies === 0}
                className="flex items-center justify-center w-full py-3 px-4 border border-orange-200 text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertCircle className="w-5 h-5 mr-2" />
                {reportSubmitting ? 'Submitting...' : "I can't find this book on the shelf"}
              </button>
            ) : (
              <div className="bg-green-50 text-green-800 p-4 rounded-lg flex items-center justify-center border border-green-200">
                <p className="text-sm font-medium">Thank you! A librarian has been notified to check the shelf.</p>
              </div>
            )}
            {book.available_copies === 0 && !reported && (
              <p className="text-xs text-center text-gray-500 mt-2">
                This book is currently checked out, so it will not be on the shelf.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
