"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/image-utils";

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"] as const;
const MAX_COVER_MB = 5;

interface CoverUploaderProps {
  coverPreviewUrl: string | null;
  coverUrl: string;
  onCoverSelected: (file: File | null) => void;
}

export function CoverUploader({ coverPreviewUrl, coverUrl, onCoverSelected }: CoverUploaderProps) {
  const source = coverPreviewUrl || coverUrl || "/images/default-book-cover.png";
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="sticky top-24 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <ImageIcon className="h-4 w-4 text-muted-foreground/70" />
          Book Cover
        </h3>

        <div className="relative flex aspect-[2/3] flex-col items-center justify-center overflow-hidden rounded-xl border border-border/30 bg-muted/20 group transition-all">
          <Image
            src={failedSource === source ? "/images/default-book-cover.png" : source}
            onError={() => setFailedSource(source)}
            alt="Preview"
            fill
            className="object-cover transition-transform group-hover:scale-105"
            unoptimized={true}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center z-10">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-lg text-xs font-bold border border-white/20"
              onClick={() => (document.getElementById('file-upload') as HTMLInputElement).click()}
            >
              {(coverPreviewUrl || coverUrl) ? 'Change Image' : 'Upload Image'}
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <input
            id="file-upload"
            aria-label="Book cover image"
            type="file"
            accept="image/jpeg, image/png, image/webp, image/jpg, image/gif"
            className="hidden"
            onChange={e => {
              const input = e.target;
              const file = input.files?.[0];
              if (!file) return;
              const error = validateImageFile(file, { maxMB: MAX_COVER_MB, allowedTypes: COVER_TYPES });
              if (error) {
                // Keep the current cover and say why the file was refused.
                setUploadError(error);
                toast.error(error);
                input.value = '';
                return;
              }
              setUploadError(null);
              onCoverSelected(file);
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
          <p className="text-[11px] text-muted-foreground text-center font-medium">Supported: JPG, PNG, WEBP, GIF (Max 5MB)</p>
          {uploadError && (
            <p role="alert" className="text-center text-[11px] font-semibold text-destructive">{uploadError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
