"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  resourceId: string;
  fileUrl: string;
  title: string;
}

type UiPreferencesResponse = {
  preferences?: {
    readProgress?: Record<string, number>;
  };
};

export function PDFViewer({ resourceId, fileUrl, title }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const response = await fetch("/api/ui-preferences");
        if (response.ok) {
          const payload = (await response.json()) as UiPreferencesResponse;
          const saved = payload.preferences?.readProgress?.[resourceId];
          if (typeof saved === "number" && saved > 0) {
            setPageNumber(saved);
          }
        }
      } finally {
        setProgressLoaded(true);
      }
    };

    void loadProgress();
  }, [resourceId]);

  useEffect(() => {
    if (!progressLoaded || pageNumber <= 0) return;

    const timeout = setTimeout(() => {
      void fetch("/api/ui-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readProgress: {
            [resourceId]: pageNumber,
          },
        }),
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [pageNumber, resourceId, progressLoaded]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber((prev) => Math.min(Math.max(1, prev), numPages));
  }

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
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

  const readingProgress = useMemo(() => {
    if (!numPages) return 0;
    return Math.round((pageNumber / numPages) * 100);
  }, [pageNumber, numPages]);

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full flex-col overflow-hidden bg-muted ${isFullscreen ? "fixed inset-0 z-[100]" : "rounded-lg border border-border shadow-sm"}`}
    >
      <div className="z-10 flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
            <BookOpen size={14} />
          </div>
          <h2 className="truncate text-xs font-semibold tracking-tight text-foreground">{title}</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-border bg-muted p-0.5">
            <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <ZoomOut size={14} />
            </Button>
            <span className="w-10 text-center text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.min(3, s + 0.1))} className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <ZoomIn size={14} />
            </Button>
          </div>

          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-7 w-7 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 justify-center overflow-auto p-2 md:p-3">
        <Card className="overflow-hidden rounded-md border-border bg-card shadow-sm">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center p-10 text-muted-foreground">
                <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                <p className="text-xs font-medium tracking-tight">Loading PDF...</p>
              </div>
            }
            error={
              <div className="p-8 text-center text-sm text-red-500">
                <p>Failed to load PDF</p>
              </div>
            }
          >
            <Page pageNumber={pageNumber} scale={scale} renderAnnotationLayer renderTextLayer className="bg-card" />
          </Document>
        </Card>
      </div>

      <div className="z-10 border-t border-border bg-card px-3 py-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => changePage(-1)} disabled={pageNumber <= 1} className="h-7 w-7 rounded-md">
              <ChevronLeft size={14} />
            </Button>
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1">
              <Input
                type="number"
                value={pageNumber}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (numPages && val >= 1 && val <= numPages) setPageNumber(val);
                }}
                className="h-auto w-9 border-none bg-transparent p-0 text-center text-xs font-semibold text-muted-foreground focus:ring-0"
              />
              <span className="text-[10px] text-muted-foreground">/ {numPages || "--"}</span>
            </div>
            <Button variant="outline" size="icon" onClick={() => changePage(1)} disabled={!!numPages && pageNumber >= numPages} className="h-7 w-7 rounded-md">
              <ChevronRight size={14} />
            </Button>
          </div>

          <span className="text-[10px] font-semibold text-muted-foreground">{readingProgress}%</span>
        </div>

        <Slider value={[pageNumber]} max={numPages || 100} min={1} step={1} onValueChange={([val]) => setPageNumber(val)} className="cursor-pointer" />
      </div>
    </div>
  );
}
