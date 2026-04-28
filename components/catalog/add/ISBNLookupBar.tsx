"use client";

import { Search, Camera, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ISBNLookupBarProps {
  isbn: string;
  onIsbnChange: (isbn: string) => void;
  onFetchData: () => void;
  isbnLoading: boolean;
  cameraSupported: boolean;
  cameraOpen: boolean;
  isInitializing: boolean;
  cameraIssue: string | null;
  scannerId: string;
  onToggleCamera: () => void;
  scanNotice: string;
}

export function ISBNLookupBar({
  isbn,
  onIsbnChange,
  onFetchData,
  isbnLoading,
  cameraSupported,
  cameraOpen,
  isInitializing,
  cameraIssue,
  scannerId,
  onToggleCamera,
  scanNotice,
}: ISBNLookupBarProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border/40 bg-card/50 p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-foreground/80">
        <Search className="w-4 h-4 text-primary/70" />
        <span className="text-xs font-bold uppercase tracking-wider">ISBN Quick Lookup</span>
      </div>
      
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text" 
            value={isbn}
            onChange={(e) => onIsbnChange(e.target.value)}
            className="h-10 w-full rounded-xl border-border/40 bg-background px-4 text-sm transition-all focus:ring-2 focus:ring-primary/20 shadow-sm"
            placeholder="Enter ISBN-10 or ISBN-13"
          />
        </div>
        <Button 
          type="button" 
          onClick={onFetchData}
          disabled={isbnLoading || !isbn}
          className="h-10 rounded-xl bg-primary px-6 text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
        >
          {isbnLoading ? 'Searching...' : 'Fetch Data'}
        </Button>
      </div>

      {cameraSupported && (
        <div className="space-y-3 rounded-xl border border-border/30 bg-background/50 p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={cameraOpen ? 'destructive' : 'secondary'}
              className="h-9 rounded-lg text-xs font-bold border border-border/40 transition-colors"
              onClick={onToggleCamera}
              disabled={isInitializing}
            >
              <Camera className="mr-2 h-4 w-4" />
              {isInitializing ? 'Starting...' : (cameraOpen ? 'Stop ISBN Scanner' : 'Start Scanner')}
            </Button>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-border/40 bg-black/90 aspect-video transition-all">
            <div 
              id={scannerId} 
              className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover" 
            />
            {!cameraOpen && (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <ScanLine className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Scanner idle</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {!cameraSupported && (
        <p className="text-[11px] text-destructive font-bold">{cameraIssue || 'Camera scanner unsupported in this browser.'}</p>
      )}
      
      {scanNotice && <p className="text-[11px] font-medium text-primary/80">{scanNotice}</p>}
      <p className="text-[10px] text-muted-foreground/70 font-medium">Retrieves title, author, and cover from Open Library API.</p>
    </div>
  );
}
