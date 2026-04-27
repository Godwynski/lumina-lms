"use client";

import Image from "next/image";
import { BookPlus, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoverUploaderProps {
  coverPreviewUrl: string | null;
  coverUrl: string;
  onCoverSelected: (file: File | null) => void;
}

export function CoverUploader({ coverPreviewUrl, coverUrl, onCoverSelected }: CoverUploaderProps) {
  return (
    <div className="space-y-4">
      <div className="sticky top-24 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <ImageIcon className="h-4 w-4 text-muted-foreground/70" />
          Book Cover
        </h3>
        
        <div className="relative flex aspect-[2/3] flex-col items-center justify-center overflow-hidden rounded-xl border border-border/30 bg-muted/20 group transition-all">
          {coverPreviewUrl || coverUrl ? (
            <>
              <Image 
                src={coverPreviewUrl || coverUrl} 
                alt="Preview" 
                fill
                className="object-cover transition-transform group-hover:scale-105"
                unoptimized={true}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  className="h-8 rounded-lg text-xs font-bold border border-white/20" 
                  onClick={() => (document.getElementById('file-upload') as HTMLInputElement).click()}
                >
                  Change Image
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center p-6 flex flex-col items-center">
              <BookPlus className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-[11px] text-muted-foreground/70 font-semibold uppercase tracking-widest">No Cover</p>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <input 
            id="file-upload"
            type="file" 
            accept="image/jpeg, image/png, image/webp, image/jpg, image/gif"
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                onCoverSelected(e.target.files[0]);
              }
            }}
          />
          <Button 
            type="button"
            variant="outline" 
            className="h-10 w-full gap-2 rounded-xl text-xs font-bold border-border/40 transition-colors hover:bg-muted"
            onClick={() => (document.getElementById('file-upload') as HTMLInputElement).click()}
          >
            Upload File
          </Button>
          <p className="text-[10px] text-muted-foreground/60 text-center font-medium">Supported: JPG, PNG, WEBP (Max 2MB)</p>
        </div>
      </div>
    </div>
  );
}
