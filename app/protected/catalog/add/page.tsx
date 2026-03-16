'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createBook } from '@/lib/actions/catalog';
import { Camera, ChevronLeft, Search, Save, BookPlus, ImageIcon, Info, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
          setFormData(prev => ({
            ...prev,
            title: info.title || prev.title,
            author: info.authors ? info.authors.join(', ') : prev.author,
            cover_url: info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.thumbnail || prev.cover_url,
            tags: info.categories ? info.categories.join(', ') : prev.tags,
          }));
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
          setFormData(prev => ({
            ...prev,
            title: bookData.title || prev.title,
            author: bookData.authors?.[0]?.name || prev.author,
            cover_url: bookData.cover?.large || bookData.cover?.medium || prev.cover_url,
            tags: bookData.subjects ? bookData.subjects.slice(0, 5).map((s: { name: string }) => s.name).join(', ') : prev.tags,
          }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let finalCoverUrl = formData.cover_url;

      // Handle cover upload if file selected
      if (coverFile) {
        const fileForm = new FormData();
        fileForm.append('file', coverFile);
        
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: fileForm,
        });
        
        const uploadData = await uploadRes.json();
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

      router.push('/protected/catalog');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add book';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/protected/catalog">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-zinc-100">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 leading-tight">Add New Book</h1>
          <p className="text-zinc-500 text-sm">Enter book details or use ISBN lookup.</p>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm flex items-center gap-2 shadow-sm">
          <Info className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl border border-zinc-200/50 shadow-sm space-y-8">
            {/* ISBN Lookup Section */}
            <div className="space-y-4 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
               <div className="flex items-center gap-2 text-indigo-700 mb-1">
                 <Search className="w-4 h-4" />
                 <span className="text-sm font-semibold uppercase tracking-wider">ISBN Quick Lookup</span>
               </div>
               <div className="flex gap-3">
                 <div className="flex-1">
                    <input 
                      type="text" 
                      value={formData.isbn}
                      onChange={e => setFormData({...formData, isbn: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                      placeholder="Enter ISBN-10 or ISBN-13"
                    />
                 </div>
                   <Button 
                     type="button" 
                    onClick={() => void handleIsbnLookup()}
                    disabled={isbnLoading || !formData.isbn}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-[42px] px-6 font-medium shadow-sm shadow-indigo-200/50 transition-all"
                  >
                    {isbnLoading ? 'Searching...' : 'Fetch Data'}
                  </Button>
                </div>
                {cameraSupported && (
                  <div className="space-y-3 rounded-xl border border-indigo-100 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-lg"
                        onClick={() => void requestCameraPermission()}
                      >
                        {cameraPermission === 'granted' ? 'Camera Enabled' : 'Enable Camera Permission'}
                      </Button>
                      <Button
                        type="button"
                        variant={cameraOpen ? 'destructive' : 'outline'}
                        className="h-9 rounded-lg"
                        onClick={() => (cameraOpen ? stopScanner() : setCameraOpen(true))}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        {cameraOpen ? 'Stop ISBN Scanner' : 'Start ISBN Scanner'}
                      </Button>
                    </div>
                    <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                      <video ref={videoRef} className="h-44 w-full object-cover" muted playsInline />
                      {!cameraOpen && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-zinc-100">
                          <div className="text-center">
                            <ScanLine className="mx-auto mb-2 h-5 w-5 text-indigo-200" />
                            <p className="text-xs font-medium">Scanner idle</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!cameraSupported && (
                  <p className="text-[11px] text-zinc-500">Camera scanner unsupported in this browser. Manual ISBN still works.</p>
                )}
                {scanNotice && <p className="text-[11px] text-zinc-600">{scanNotice}</p>}
                <p className="text-[11px] text-zinc-500">Retrieves title, author, and cover from Open Library API.</p>
             </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Book Title *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. Clean Code"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-sm outline-none"
                  />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Author *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.author}
                    onChange={e => setFormData({...formData, author: e.target.value})}
                    placeholder="e.g. Robert C. Martin"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Physical Section</label>
                  <input 
                    type="text" 
                    value={formData.section}
                    onChange={e => setFormData({...formData, section: e.target.value})}
                    placeholder="e.g. CS Reference"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-sm outline-none"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Exact Location</label>
                  <input 
                    type="text" 
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g. Shelf A-5"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Initial Copies</label>
                  <input 
                    type="number" 
                    min="1"
                    max="100"
                    value={formData.copies}
                    onChange={e => setFormData({...formData, copies: parseInt(e.target.value) || 0})}
                    placeholder="1"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-sm outline-none font-semibold text-indigo-600"
                  />
                  <p className="text-[10px] text-zinc-400 ml-1">How many physical copies to add now? (Default: 1)</p>
                </div>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Subject Tags (Comma Separated)</label>
                <input 
                  type="text" 
                  value={formData.tags}
                  onChange={e => setFormData({...formData, tags: e.target.value})}
                  placeholder="Programming, Best Practices, Engineering"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-sm outline-none"
                />
              </div>
            </div>

            <div className="pt-4 flex gap-4">
               <Button 
                type="submit" 
                disabled={loading}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl h-12 font-bold shadow-lg shadow-zinc-200 transition-all"
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
                className="h-12 rounded-xl px-8 font-semibold"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Sidebar / Preview */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200/50 shadow-sm sticky top-24">
            <h3 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              Book Cover
            </h3>
            
            <div className="aspect-[2/3] bg-zinc-50 rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center relative group overflow-hidden">
               {formData.cover_url || coverFile ? (
                 <>
                   <Image 
                    src={coverFile ? URL.createObjectURL(coverFile) : formData.cover_url} 
                    alt="Preview" 
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                   />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" size="sm" className="rounded-lg h-8 text-[11px]" onClick={() => (document.getElementById('file-upload') as HTMLInputElement).click()}>
                        Change Image
                      </Button>
                   </div>
                 </>
               ) : (
                 <div className="text-center p-6 flex flex-col items-center">
                    <BookPlus className="w-10 h-10 text-zinc-300 mb-3" />
                    <p className="text-xs text-zinc-400 font-medium">No cover image selected</p>
                 </div>
               )}
            </div>

            <div className="mt-6 space-y-3">
              <input 
                id="file-upload"
                type="file" 
                accept="image/jpeg, image/png, image/webp"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    setCoverFile(e.target.files[0]);
                  }
                }}
              />
              <Button 
                variant="outline" 
                className="w-full rounded-xl gap-2 text-xs h-10 border-zinc-200 hover:bg-zinc-50"
                onClick={() => (document.getElementById('file-upload') as HTMLInputElement).click()}
              >
                Upload File
              </Button>
              <p className="text-[10px] text-zinc-400 text-center italic">Supported: JPG, PNG, WEBP (Max 2MB)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
