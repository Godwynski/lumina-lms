'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getBookById, getBookCopies, createBookCopy, updateBookCopyStatus } from '@/lib/actions/catalog';
import { 
  ChevronLeft, 
  Plus, 
  MapPin, 
  Hash, 
  Tag, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  Wrench, 
  SearchX,
  History,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRPrinterModal } from '@/components/qr-printer-modal';
import Link from 'next/link';
import { Book, BookCopy } from '@/lib/types';

const STATUS_CONFIG = {
  'AVAILABLE': { label: 'Available', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  'BORROWED': { label: 'Borrowed', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
  'MAINTENANCE': { label: 'Maintenance', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
  'LOST': { label: 'Lost', icon: SearchX, color: 'text-red-600', bg: 'bg-red-50' },
};

export default function StaffBookManagementPage() {
  const params = useParams();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();
  const id = params.id as string;
  
  const [book, setBook] = useState<Book | null>(null);
  const [copies, setCopies] = useState<BookCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCopyLoading, setAddCopyLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, copiesData] = await Promise.all([
          getBookById(id),
          getBookCopies(id)
        ]);
        setBook(bookData);
        setCopies(copiesData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadData();
  }, [id]);

  const handleAddCopy = async () => {
    setAddCopyLoading(true);
    try {
      await createBookCopy(id, 'New Condition');
      const updatedCopies = await getBookCopies(id);
      setCopies(updatedCopies);
      // Refresh book data for the counts
      const updatedBook = await getBookById(id);
      setBook(updatedBook);
    } catch (err) {
      console.error(err);
    } finally {
      setAddCopyLoading(false);
    }
  };

  const handleStatusChange = async (copyId: string, newStatus: string) => {
    try {
      await updateBookCopyStatus(copyId, newStatus as any);
      const updatedCopies = await getBookCopies(id);
      setCopies(updatedCopies);
      const updatedBook = await getBookById(id);
      setBook(updatedBook);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 text-sm font-medium">Loading inventory...</p>
      </div>
    </div>
  );

  if (!book) return <div className="p-12 text-center text-zinc-500">Book not found.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/protected/catalog">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-zinc-100">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{book.title}</h1>
            <p className="text-zinc-500 text-sm">{book.author} — <span className="font-medium text-zinc-700">Inventory ID: {id.slice(0, 8)}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleAddCopy} 
            disabled={addCopyLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-6 shadow-sm shadow-indigo-100 transition-all font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Physical Copy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Book Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-zinc-200/50 shadow-sm overflow-hidden p-6">
            <div className="relative aspect-[2/3] bg-zinc-50 rounded-xl border border-zinc-100 mb-6 overflow-hidden flex items-center justify-center">
              {book.cover_url ? (
                <Image src={book.cover_url} alt={book.title} fill className="object-cover" />
              ) : (
                <BookOpen className="w-16 h-16 text-zinc-200" />
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-zinc-600 text-sm">
                <Hash className="w-4 h-4 text-zinc-400" />
                <span className="font-medium">ISBN:</span> {book.isbn || 'Unknown'}
              </div>
              <div className="flex items-center gap-3 text-zinc-600 text-sm">
                <Tag className="w-4 h-4 text-zinc-400" />
                <span className="font-medium">Category:</span> {Array.isArray(book.categories) ? book.categories[0]?.name : book.categories?.name || 'Unassigned'}
              </div>
              <div className="flex items-center gap-3 text-zinc-600 text-sm">
                <MapPin className="w-4 h-4 text-zinc-400" />
                <span className="font-medium">Section:</span> {book.section || 'N/A'}
              </div>
            </div>

            {book.tags && book.tags.length > 0 && (
              <div className="mt-6 pt-6 border-t border-zinc-100">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {book.tags.map((tag: string, i: number) => (
                    <span key={i} className="bg-zinc-50 text-zinc-600 px-2 py-1 rounded-md text-[11px] border border-zinc-200/50">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl shadow-sm">
             <h3 className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">
               <QrCode className="w-4 h-4" />
               Staff Tooltip
             </h3>
             <p className="text-xs text-indigo-700 leading-relaxed mb-4">
               Each physical copy of this book has a unique QR string. Print the label and attach it to the inside cover for easy scanning and monitoring.
             </p>
             <div className="p-3 bg-white/50 border border-indigo-200/50 rounded-xl space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-indigo-600 font-medium tracking-tight">Total Inventory:</span>
                  <span className="text-indigo-900 font-bold">{book.total_copies}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-indigo-600 font-medium tracking-tight">Available on Shelves:</span>
                  <span className="text-indigo-900 font-bold">{book.available_copies}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Inventory List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 px-1">Physical Inventory ({copies.length})</h2>
          
          <div className="space-y-3">
            {copies.map((copy) => {
              const status = STATUS_CONFIG[copy.status];
              const StatusIcon = status.icon;
              
              return (
                <div key={copy.id} className="bg-white p-5 rounded-2xl border border-zinc-200/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-indigo-200/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${status.bg} flex items-center justify-center shrink-0`}>
                      <StatusIcon className={`w-6 h-6 ${status.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-zinc-900">{copy.qr_string}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">Added on {new Date(copy.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                     <select 
                      value={copy.status}
                      onChange={(e) => handleStatusChange(copy.id, e.target.value)}
                      className="bg-zinc-50 border border-zinc-200 text-zinc-600 text-[11px] font-bold p-2 h-10 px-4 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>

                    <QRPrinterModal 
                      qrString={copy.qr_string} 
                      bookTitle={book.title} 
                      bookId={book.id} 
                    />
                  </div>
                </div>
              );
            })}

            {copies.length === 0 && (
              <div className="text-center py-24 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                <AlertCircle className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-500 font-medium">No physical copies in inventory.</p>
                <p className="text-zinc-400 text-xs">Click &quot;Add Physical Copy&quot; to start tracking inventory.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
