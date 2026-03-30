'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createBook, getCategories } from '@/lib/actions/catalog';
import { Camera, ChevronLeft, Search, Save, BookPlus, ImageIcon, Info, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { compressImage } from '@/lib/image-utils';

type BarcodeLike = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeLike[]>;
};

type WindowWithDetector = Window & {
  BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
};

const SCAN_DEBOUNCE_MS = 1200;

export default function AddBookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanNotice, setScanNotice] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastAcceptedScanRef = useRef<{ value: string; at: number } | null>(null);

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

      // 1. Try Google Books API First (usually better metadata and covers)
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

      // 2. Fallback to Open Library if Google didn't find it or failed
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

  const stopScanner = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const requestCameraPermission = useCallback(async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setScanNotice('Camera API is unavailable in this browser.');
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      media.getTracks().forEach((track) => track.stop());
      setCameraPermission('granted');
      setScanNotice('Camera permission granted. Start scanner to capture ISBN barcode.');
    } catch {
      setCameraPermission('denied');
      setScanNotice('Camera permission denied. Allow camera access in browser settings.');
    }
  }, []);

  const handleScannedCode = useCallback(
    async (rawValue: string) => {
      const now = Date.now();
      const last = lastAcceptedScanRef.current;
      if (last && last.value === rawValue && now - last.at < SCAN_DEBOUNCE_MS) {
        return;
      }
      lastAcceptedScanRef.current = { value: rawValue, at: now };

      const isbn = normalizeIsbn(rawValue);
      if (!isbn) {
        setScanNotice('Scanned code is not a valid ISBN-10 or ISBN-13.');
        return;
      }

      setFormData((prev) => ({ ...prev, isbn }));
      setScanNotice(`Scanned ISBN ${isbn}. Looking up book data...`);
      stopScanner();
      await handleIsbnLookup(isbn);
    },
    [handleIsbnLookup, normalizeIsbn, stopScanner],
  );

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
    const detectorCtor = (window as WindowWithDetector).BarcodeDetector;
    setCameraSupported(
      !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function' &&
        !!detectorCtor,
    );
  }, []);

  useEffect(() => {
    if (!cameraOpen || !cameraSupported) return;

    let mounted = true;
    const detectorCtor = (window as WindowWithDetector).BarcodeDetector;
    if (detectorCtor) {
      detectorRef.current = new detectorCtor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      });
    }

    const start = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!mounted) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = media;
        setCameraPermission('granted');

        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play();
        }

        const tick = async () => {
          if (!mounted || !videoRef.current || !detectorRef.current) return;

          try {
            if (videoRef.current.readyState >= 2) {
              const codes = await detectorRef.current.detect(videoRef.current);
              const first = codes.find((code) => !!code.rawValue?.trim());
              if (first?.rawValue) {
                await handleScannedCode(first.rawValue);
              }
            }
          } catch {
            // Keep scanner loop alive.
          }

          frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch {
        setCameraPermission('denied');
        setScanNotice('Unable to access camera. You can still enter ISBN manually.');
        stopScanner();
      }
    };

    void start();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [cameraOpen, cameraSupported, handleScannedCode, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

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

      // Handle cover upload if file selected OR auto-persist remote URL
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
          // Send URL to server for fetching (bypasses client-side CORS)
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

      // Convert tags string to array
      const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);

      // Save book
      await createBook({
        title: formData.title,
        author: formData.author,
        isbn: formData.isbn || null,
        category_id: formData.categoryId || null,
        tags: tagsArray,
        location: formData.location,
        section: formData.section,
        cover_url: finalCoverUrl,
      }, formData.copies);

      router.refresh();
      router.push('/protected/catalog');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add book';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4 pb-4 sm:pb-6 md:pb-8">
      <div className="flex items-center gap-4">
        <Link href="/protected/catalog">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold leading-tight text-foreground">Add Book</h1>
          <p className="text-xs text-muted-foreground">Enter details or scan ISBN.</p>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm flex items-center gap-2 shadow-sm">
          <Info className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            {/* ISBN Lookup Section */}
             <div className="space-y-3 rounded-lg border border-border bg-muted p-3">
               <div className="mb-1 flex items-center gap-2 text-slate-700">
                 <Search className="w-4 h-4" />
                 <span className="text-sm font-semibold uppercase tracking-wider">ISBN Quick Lookup</span>
               </div>
               <div className="flex gap-2">
                 <div className="flex-1">
                    <Input
                      type="text" 
                      value={formData.isbn}
                      onChange={e => setFormData({...formData, isbn: e.target.value})}
                       className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm transition-all focus:ring-2 focus:ring-ring"
                       placeholder="Enter ISBN-10 or ISBN-13"
                     />
                  </div>
                   <Button 
                     type="button" 
                    onClick={() => void handleIsbnLookup()}
                    disabled={isbnLoading || !formData.isbn}
                    className="h-9 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                   >
                     {isbnLoading ? 'Searching...' : 'Fetch Data'}
                   </Button>
                 </div>
                 {cameraSupported && (
                  <div className="space-y-2 rounded-lg border border-border bg-card p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-md text-xs"
                        onClick={() => void requestCameraPermission()}
                      >
                        {cameraPermission === 'granted' ? 'Camera Enabled' : 'Enable Camera Permission'}
                      </Button>
                      <Button
                        type="button"
                        variant={cameraOpen ? 'destructive' : 'outline'}
                        className="h-8 rounded-md text-xs"
                        onClick={() => (cameraOpen ? stopScanner() : setCameraOpen(true))}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        {cameraOpen ? 'Stop ISBN Scanner' : 'Start ISBN Scanner'}
                      </Button>
                    </div>
                    <div className="relative overflow-hidden rounded-md border border-border bg-primary">
                      <video ref={videoRef} className="h-36 w-full object-cover" muted playsInline />
                      {!cameraOpen && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-zinc-100">
                          <div className="text-center">
                            <ScanLine className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                            <p className="text-xs font-medium">Scanner idle</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!cameraSupported && (
                  <p className="text-[11px] text-muted-foreground">Camera scanner unsupported in this browser. Manual ISBN still works.</p>
                )}
                {scanNotice && <p className="text-[11px] text-muted-foreground">{scanNotice}</p>}
                <p className="text-[11px] text-muted-foreground">Retrieves title, author, and cover from Open Library API.</p>
             </div>

              <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 text-left">
                  <Label className="ml-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Book Title *</Label>
                  <Input
                    type="text" 
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. Clean Code"
                    className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none transition-all focus:bg-card focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-2 text-left">
                  <Label className="ml-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Author *</Label>
                  <Input
                    type="text" 
                    required
                    value={formData.author}
                    onChange={e => setFormData({...formData, author: e.target.value})}
                    placeholder="e.g. Robert C. Martin"
                    className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none transition-all focus:bg-card focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 text-left">
                  <Label className="ml-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Category</Label>
                  <Select value={formData.categoryId || 'none'} onValueChange={(value) => setFormData({...formData, categoryId: value === 'none' ? '' : value})}>
                    <SelectTrigger className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm">
                      <SelectValue placeholder="Uncategorized" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 text-left">
                  <Label className="ml-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Physical Section</Label>
                  <Input
                    type="text" 
                    value={formData.section}
                    onChange={e => setFormData({...formData, section: e.target.value})}
                    placeholder="e.g. CS Reference"
                    className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none transition-all focus:bg-card focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <Label className="ml-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Exact Location</Label>
                  <Input
                    type="text" 
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g. Shelf A-5"
                    className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none transition-all focus:bg-card focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 text-left">
                  <Label className="ml-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Initial Copies</Label>
                  <Input
                    type="number" 
                    min="1"
                    max="100"
                    value={formData.copies}
                    onChange={e => setFormData({...formData, copies: parseInt(e.target.value) || 0})}
                    placeholder="1"
                    className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm font-semibold text-foreground outline-none transition-all focus:bg-card focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-[10px] text-muted-foreground ml-1">How many physical copies to add now? (Default: 1)</p>
                </div>
              </div>

              <div className="space-y-2 text-left">
                  <Label className="ml-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Subject Tags (Comma Separated)</Label>
                <Input
                  type="text" 
                  value={formData.tags}
                  onChange={e => setFormData({...formData, tags: e.target.value})}
                  placeholder="Programming, Best Practices, Engineering"
                  className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none transition-all focus:bg-card focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
               <Button 
                type="submit" 
                disabled={loading}
                className="h-9 flex-1 rounded-md bg-primary text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
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
                onClick={() => router.push('/protected/catalog')}
                className="h-9 rounded-md px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Sidebar / Preview */}
          <div className="space-y-4">
          <div className="sticky top-24 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Book Cover
            </h3>
            
            <div className="relative flex aspect-[2/3] flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted group">
               {coverPreviewUrl || formData.cover_url ? (
                 <>
                   <Image 
                    src={coverPreviewUrl || formData.cover_url} 
                    alt="Preview" 
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    unoptimized={true}
                   />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                       <Button type="button" variant="secondary" size="sm" className="h-7 rounded-md text-[11px]" onClick={() => (document.getElementById('file-upload') as HTMLInputElement).click()}>
                        Change Image
                      </Button>
                   </div>
                 </>
               ) : (
                 <div className="text-center p-6 flex flex-col items-center">
                    <BookPlus className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-medium">No cover image selected</p>
                 </div>
               )}
            </div>

            <div className="mt-4 space-y-2">
              <input 
                id="file-upload"
                type="file" 
                accept="image/jpeg, image/png, image/webp, image/jpg, image/gif"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    setCoverFile(e.target.files[0]);
                  }
                }}
              />
              <Button 
                variant="outline" 
                className="h-8 w-full gap-2 rounded-md border-border text-xs hover:bg-muted"
                onClick={() => (document.getElementById('file-upload') as HTMLInputElement).click()}
              >
                Upload File
              </Button>
              <p className="text-[10px] text-muted-foreground text-center italic">Supported: JPG, PNG, WEBP (Max 2MB)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
