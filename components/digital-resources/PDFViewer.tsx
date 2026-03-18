"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2,
  Search,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  resourceId: string;
  fileUrl: string;
  title: string;
}

export function PDFViewer({ resourceId, fileUrl, title }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved progress
  useEffect(() => {
    const savedPage = localStorage.getItem(`read_progress_${resourceId}`);
    if (savedPage) {
      setPageNumber(parseInt(savedPage));
    }
  }, [resourceId]);

  // Save progress
  useEffect(() => {
    if (pageNumber > 0) {
      localStorage.setItem(`read_progress_${resourceId}`, pageNumber.toString());
    }
  }, [pageNumber, resourceId]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const next = prevPageNumber + offset;
      if (numPages && next >= 1 && next <= numPages) {
        return next;
      }
      return prevPageNumber;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative flex flex-col h-full bg-zinc-100 overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100]' : 'rounded-3xl border border-zinc-200 shadow-inner'}`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-2xl border-b border-zinc-200 z-10">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/50">
            <BookOpen size={16} />
          </div>
          <h2 className="text-sm font-bold text-zinc-900 truncate max-w-[180px] md:max-w-md tracking-tight">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-50 rounded-xl border border-zinc-200 p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 h-8 w-8 rounded-lg"
            >
              <ZoomOut size={16} />
            </Button>
            <span className="text-[10px] font-black text-zinc-400 w-12 text-center uppercase tracking-tighter">
              {Math.round(scale * 100)}%
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setScale(s => Math.min(3, s + 0.1))}
              className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 h-8 w-8 rounded-lg"
            >
              <ZoomIn size={16} />
            </Button>
          </div>
          <div className="w-px h-4 bg-zinc-200 mx-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleFullscreen}
            className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 h-10 w-10 rounded-xl border border-zinc-200"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} /> }
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex justify-center p-4 md:p-8 scrollbar-hide">
        <div className="shadow-2xl shadow-black/50">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center p-20 text-indigo-500/50">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-sm font-medium tracking-tight">Loading PDF Access...</p>
              </div>
            }
            error={
              <div className="p-10 text-red-500 text-center">
                <p>Failed to load PDF</p>
              </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              renderAnnotationLayer={true}
              renderTextLayer={true}
              className="bg-white"
            />
          </Document>
        </div>
      </div>

      {/* Floating Pagination Controller */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-20 flex items-center gap-2 p-2 bg-white/80 backdrop-blur-3xl border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-2xl transition-all hover:scale-105 group/toolbar">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => changePage(-1)}
          disabled={pageNumber <= 1}
          className="text-zinc-600 hover:bg-zinc-100 rounded-xl h-11 w-11 disabled:opacity-30"
        >
          <ChevronLeft size={22} />
        </Button>
        <div className="flex items-center gap-3 px-4 py-1 bg-zinc-50 rounded-xl border border-zinc-200">
          <input 
            type="number"
            value={pageNumber}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (numPages && val >= 1 && val <= numPages) setPageNumber(val);
            }}
            className="w-12 bg-transparent border-none text-center text-sm font-bold text-indigo-600 focus:ring-0 p-0"
          />
          <span className="text-zinc-400 font-black text-[10px] uppercase tracking-widest">of</span>
          <span className="text-zinc-900 font-bold text-sm min-w-[20px] text-center">{numPages || '--'}</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => changePage(1)}
          disabled={!!numPages && pageNumber >= numPages}
          className="text-zinc-600 hover:bg-zinc-100 rounded-xl h-11 w-11 disabled:opacity-30"
        >
          <ChevronRight size={22} />
        </Button>
      </div>

      {/* Bottom Seek Bar */}
      <div className="px-8 py-5 bg-white border-t border-zinc-200 z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-3">
          <Slider
            value={[pageNumber]}
            max={numPages || 100}
            min={1}
            step={1}
            onValueChange={([val]) => setPageNumber(val)}
            className="cursor-pointer"
          />
          <div className="flex justify-between items-center text-[9px] text-zinc-400 uppercase tracking-[0.2em] font-black">
            <div className="flex items-center gap-3">
              <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">Page {pageNumber}</span>
              <span className="opacity-40 font-bold">Total {numPages || '--'} Sections</span>
            </div>
            <span className={numPages ? "text-emerald-600" : "animate-pulse"}>
              {numPages ? `${Math.round((pageNumber / numPages) * 100)}% Reading Progress` : 'Loading Document...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
