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
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
      className={`relative flex flex-col h-full bg-zinc-900 overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100]' : 'rounded-2xl border border-zinc-800'}`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 z-10">
        <div className="flex items-center gap-3">
          <BookOpen className="text-indigo-400" size={18} />
          <h2 className="text-sm font-medium text-zinc-200 truncate max-w-[200px] md:max-w-md">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 w-8"
          >
            <ZoomOut size={16} />
          </Button>
          <span className="text-[10px] md:text-xs text-zinc-500 w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setScale(s => Math.min(3, s + 0.1))}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 w-8"
          >
            <ZoomIn size={16} />
          </Button>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleFullscreen}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 w-8"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} /> }
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
              <div className="flex flex-col items-center justify-center p-20 text-zinc-500">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Loading PDF...</p>
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

      {/* Floating Toolbar */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-20 z-20 flex items-center gap-1 p-1 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full shadow-2xl transition-opacity hover:opacity-100 opacity-90 md:opacity-40">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => changePage(-1)}
          disabled={pageNumber <= 1}
          className="text-white hover:bg-zinc-800 rounded-full h-10 w-10"
        >
          <ChevronLeft size={20} />
        </Button>
        <div className="flex items-center gap-2 px-3 text-sm font-medium text-zinc-300">
          <input 
            type="number"
            value={pageNumber}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (numPages && val >= 1 && val <= numPages) setPageNumber(val);
            }}
            className="w-12 bg-zinc-800 border-none rounded text-center focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-zinc-500">/ {numPages || '--'}</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => changePage(1)}
          disabled={!!numPages && pageNumber >= numPages}
          className="text-white hover:bg-zinc-800 rounded-full h-10 w-10"
        >
          <ChevronRight size={20} />
        </Button>
      </div>

      {/* Bottom Seek Bar */}
      <div className="px-6 py-4 bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800 z-10">
        <div className="flex flex-col gap-2">
          <Slider
            value={[pageNumber]}
            max={numPages || 100}
            min={1}
            step={1}
            onValueChange={([val]) => setPageNumber(val)}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            <span>Page {pageNumber}</span>
            <span>{numPages ? `${Math.round((pageNumber / numPages) * 100)}% Complete` : 'Loading...'}</span>
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
