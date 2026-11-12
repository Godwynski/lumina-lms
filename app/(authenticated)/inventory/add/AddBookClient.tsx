'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchISBNDetails } from '@/lib/actions/isbn-lookup';
import { createBook, getCategories } from '@/lib/actions/catalog';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { compressImage } from '@/lib/image-utils';
import { ISBNLookupBar } from '@/components/catalog/add/ISBNLookupBar';
import { BookDetailsForm } from '@/components/catalog/add/BookDetailsForm';
import { CoverUploader } from '@/components/catalog/add/CoverUploader';
import { toast } from 'sonner';
import { NavigationGuard } from '@/components/layout/NavigationGuard';

const EMPTY_FORM = {
  title: '',
  author: '',
  isbn: '',
  categoryId: '',
  tags: '',
  location: '',
  section: '',
  cover_url: '',
  copies: 1,
  dewey_decimal: '',
};

export function AddBookClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const lookupRequest = useRef(0);
  const [isbnLoading, setIsbnLoading] = useState(false);
  
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  // Set after a successful save so leaving the page doesn't trigger the guard.
  const [saved, setSaved] = useState(false);
  const isDirty =
    !saved &&
    (coverFile !== null ||
      (Object.keys(EMPTY_FORM) as Array<keyof typeof EMPTY_FORM>).some((k) => formData[k] !== EMPTY_FORM[k]));
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);


  const handleIsbnLookup = useCallback(async (isbnCandidate?: string) => {
    const sourceIsbn = (isbnCandidate ?? formData.isbn).trim();
    if (!sourceIsbn) return;
    
    const request = ++lookupRequest.current;
    setIsbnLoading(true);
    try {
      const result = await fetchISBNDetails(sourceIsbn);
      if (request !== lookupRequest.current) return;
      if (!result.success) { toast.error(result.error); return; }
      const book = result.book;
      setFormData(prev => ({ ...prev, isbn: book.isbn, title: book.title,
        author: book.author, cover_url: book.cover_url,
        tags: book.tags.join(', ') }));
      if (book.cover_url) setCoverFile(null);
      toast.success('Book details retrieved. Review them before saving.');
    } catch {
      if (request === lookupRequest.current) toast.error('Could not retrieve book details. Retry or enter them manually.');
    } finally {
      if (request === lookupRequest.current) setIsbnLoading(false);
    }
  }, [formData.isbn]);

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
          dewey_decimal: formData.dewey_decimal || null,
        },
        copiesCount: formData.copies
      });

      if (!result.success) throw new Error(result.error);

      setSaved(true);
      router.refresh();
      router.push('/inventory');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add book';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    if (updates.isbn !== undefined) { lookupRequest.current++; setIsbnLoading(false); }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="w-full space-y-6">
      <NavigationGuard isDirty={isDirty} message="You have an unsaved book draft. Leave this page and discard it?" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-8 rounded-2xl border border-border/40 bg-card p-6 sm:p-8 relative overflow-hidden">
            
            <ISBNLookupBar 
              isbn={formData.isbn}
              onIsbnChange={(isbn) => updateFormData({ isbn })}
              onFetchData={() => void handleIsbnLookup()}
              isbnLoading={isbnLoading}
            />

            <BookDetailsForm 
              formData={formData}
              onUpdate={updateFormData}
              categories={categories}
            />

            <div className="flex gap-3 pt-6 border-t border-border/30 mt-8">
              <Button 
                type="submit" 
                disabled={loading || isbnLoading}
                className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90"
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
                <Link href="/inventory">Cancel</Link>
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
