'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBook, getCategories } from '@/lib/actions/catalog';
import { Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { compressImage } from '@/lib/image-utils';

import { useScanner } from '@/hooks/use-scanner';
import { ISBNLookupBar } from '@/components/catalog/add/ISBNLookupBar';
import { BookDetailsForm } from '@/components/catalog/add/BookDetailsForm';
import { CoverUploader } from '@/components/catalog/add/CoverUploader';

export function AddBookClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanNotice, setScanNotice] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    categoryId: '',
    tags: '',
    location: '',
    section: '',
    cover_url: '',
    copies: 1,
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const normalizeIsbn = useCallback((value: string) => {
    const trimmed = value.trim().toUpperCase().replace(/^ISBN(?:-1[03])?:?\s*/, '');
    const compact = trimmed.replace(/[^0-9X]/g, '');
    if (compact.length === 10 || compact.length === 13) return compact;
    return null;
  }, []);

  const handleIsbnLookup = useCallback(async (isbnCandidate?: string) => {
    const sourceIsbn = (isbnCandidate ?? formData.isbn).trim();
    if (!sourceIsbn) return;
    
    setIsbnLoading(true);
    setError('');
    
    try {
      const cleanIsbn = sourceIsbn.replace(/[- ]/g, '');
      let bookFound = false;

      // 1. Try Google Books API First
      try {
        const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
        const googleData = await googleRes.json();

        if (googleData.items && googleData.items.length > 0) {
          const info = googleData.items[0].volumeInfo;
          setFormData(prev => {
            const rawCoverUrl = info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.thumbnail || prev.cover_url;
            const secureCoverUrl = rawCoverUrl ? rawCoverUrl.replace('http://', 'https://') : '';
            return {
              ...prev,
              title: info.title || prev.title,
              author: info.authors ? info.authors.join(', ') : prev.author,
              cover_url: secureCoverUrl,
              tags: info.categories ? info.categories.join(', ') : prev.tags,
            };
          });
          bookFound = true;
        }
      } catch (e) {
        console.error("Google Books API error:", e);
      }

      // 2. Fallback to Open Library
      if (!bookFound) {
        const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
        const olData = await olRes.json();
        const bookData = olData[`ISBN:${cleanIsbn}`];
        
        if (bookData) {
          setFormData(prev => {
            const rawCoverUrl = bookData.cover?.large || bookData.cover?.medium || prev.cover_url;
            const secureCoverUrl = rawCoverUrl ? rawCoverUrl.replace('http://', 'https://') : '';
            return {
              ...prev,
              title: bookData.title || prev.title,
              author: bookData.authors?.[0]?.name || prev.author,
              cover_url: secureCoverUrl,
              tags: bookData.subjects ? bookData.subjects.slice(0, 5).map((s: { name: string }) => s.name).join(', ') : prev.tags,
            };
          });
          bookFound = true;
        }
      }

      if (!bookFound) {
        setError('Book not found in any database. Please enter details manually.');
      }
    } catch {
      setError('Failed to fetch book data. Please check your connection.');
    } finally {
      setIsbnLoading(false);
    }
  }, [formData.isbn]);

  const {
    cameraOpen,
    startScanner,
    stopCamera,
    isInitializing,
    cameraSupported,
    cameraIssue,
    scannerId
  } = useScanner({
    onScan: async (rawValue) => {
      const isbn = normalizeIsbn(rawValue);
      if (!isbn) {
        setScanNotice('Scanned code is not a valid ISBN-10 or ISBN-13.');
        return;
      }

      setFormData((prev) => ({ ...prev, isbn }));
      setScanNotice(`Scanned ISBN ${isbn}. Looking up book data...`);
      void stopCamera();
      await handleIsbnLookup(isbn);
    },
    isProcessing: loading || isbnLoading,
    scannerId: 'isbn-scanner',
    formats: [
      9,  // EAN_13
      10, // EAN_8
      5,  // CODE_128
      14, // UPC_A
      15, // UPC_E
    ]
  });

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories();
        setCategories((data ?? []).map((c) => ({ id: c.id as string, name: c.name as string })));
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    void loadCategories();
  }, []);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let finalCoverUrl = formData.cover_url;
      const uploadFile = coverFile;

      if (uploadFile || (!uploadFile && formData.cover_url && formData.cover_url.startsWith('http'))) {
        const fileForm = new FormData();
        
        if (uploadFile) {
          const compressedBlob = await compressImage(uploadFile, {
            maxDimension: 1200,
            quality: 0.8,
            type: "image/webp"
          });
          fileForm.append('file', new File([compressedBlob], `cover-${Date.now()}.webp`, { type: "image/webp" }));
        } else {
          fileForm.append('url', formData.cover_url);
        }
        
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: fileForm,
        });
        
        let uploadData;
        try {
          uploadData = await uploadRes.json();
        } catch {
          if (uploadRes.status === 413) {
            throw new Error('Image is too large. Even after compression, it exceeds the 5MB server limit.');
          }
          throw new Error(`Upload failed with status ${uploadRes.status}`);
        }

        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
        
        finalCoverUrl = uploadData.cover_url;
      }

      const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);

      const result = await createBook({
        bookData: {
          title: formData.title,
          author: formData.author,
          isbn: formData.isbn || null,
          category_id: formData.categoryId || null,
          tags: tagsArray,
          location: formData.location,
          section: formData.section,
          cover_url: finalCoverUrl,
        },
        copiesCount: formData.copies
      });

      if (!result.success) throw new Error(result.error);

      router.refresh();
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add book';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="w-full space-y-6 max-w-6xl mx-auto">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm flex items-center gap-3 font-medium">
          <Info className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-8 rounded-2xl border border-border/40 bg-card p-6 sm:p-8 shadow-sm relative overflow-hidden">
            
            <ISBNLookupBar 
              isbn={formData.isbn}
              onIsbnChange={(isbn) => updateFormData({ isbn })}
              onFetchData={() => void handleIsbnLookup()}
              isbnLoading={isbnLoading}
              cameraSupported={cameraSupported}
              cameraOpen={cameraOpen}
              isInitializing={isInitializing}
              cameraIssue={cameraIssue}
              scannerId={scannerId}
              onToggleCamera={() => cameraOpen ? void stopCamera() : void startScanner()}
              scanNotice={scanNotice}
            />

            <BookDetailsForm 
              formData={formData}
              onUpdate={updateFormData}
              categories={categories}
            />

            <div className="flex gap-3 pt-6 border-t border-border/30 mt-8">
              <Button 
                type="submit" 
                disabled={loading}
                className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
              >
                {loading ? 'Processing...' : (
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save to Catalog
                  </div>
                )}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                asChild
                className="h-11 rounded-xl px-8 text-sm font-bold border-border/40 hover:bg-muted transition-colors"
              >
                <Link href="/dashboard">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>

        <div>
          <CoverUploader 
            coverPreviewUrl={coverPreviewUrl}
            coverUrl={formData.cover_url}
            onCoverSelected={setCoverFile}
          />
        </div>
      </div>
    </div>
  );
}
