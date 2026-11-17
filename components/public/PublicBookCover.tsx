"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";

interface PublicBookCoverProps {
  src?: string | null;
  title: string;
}

const DEFAULT_COVER = "/images/default-book-cover.png";

export function PublicBookCover({ src, title }: PublicBookCoverProps) {
  const [imgSrc, setImgSrc] = useState(src || DEFAULT_COVER);
  const [failedCompletely, setFailedCompletely] = useState(false);

  return (
    <div className="relative h-full w-full">
      <div
        aria-hidden={!failedCompletely}
        className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-muted-foreground"
      >
        <BookOpen className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium line-clamp-3">{title}</span>
      </div>

      {!failedCompletely && (
        <Image
          src={imgSrc}
          alt={title}
          fill
          unoptimized
          className="object-cover"
          onError={() => {
            if (imgSrc !== DEFAULT_COVER) {
              setImgSrc(DEFAULT_COVER);
            } else {
              setFailedCompletely(true);
            }
          }}
        />
      )}
    </div>
  );
}
