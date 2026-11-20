'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn, getCategoryName } from '@/lib/utils';
import { StatusBanner } from './StatusBanner';
import type { AvailabilityStatus, BookDetail } from './types';

interface CatalogBookDetailsProps {
  book: BookDetail;
  availability: AvailabilityStatus;
  isAvailabilityLoading?: boolean;
  fullPage?: boolean;
  actions?: ReactNode;
}

export function CatalogBookDetails({ book, availability, isAvailabilityLoading, fullPage = false, actions }: CatalogBookDetailsProps) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const imgSrc = book.cover_url && failedCover !== book.cover_url ? book.cover_url : '/images/default-book-cover.png';
  const categoryName = getCategoryName(book.categories);
  const outOfService = availability.outOfServiceCount ?? 0;
  const borrowed = Math.max(0, book.total_copies - book.available_copies - outOfService);
  const tags = book.tags ?? [];
  const tagLimit = fullPage ? 4 : 3;

  return (
    <div className="min-w-0 space-y-5">
      <section aria-label="Book overview" className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-4">
          <div className={cn(
            'relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted',
            fullPage ? 'sm:w-28 lg:w-32' : 'sm:w-24',
          )}>
            <Image
              src={imgSrc}
              alt={book.title}
              fill
              className="object-cover"
              sizes={fullPage ? '(min-width: 1024px) 128px, (min-width: 640px) 112px, 64px' : '(min-width: 640px) 96px, 64px'}
              unoptimized
              onError={() => setFailedCover(book.cover_url || null)}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className={cn("break-words text-xl font-semibold leading-tight tracking-tight sm:text-2xl", fullPage && "lg:text-3xl")}>{book.title}</h2>
            <p className="break-words text-sm text-muted-foreground">{book.author}</p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {tags.slice(0, tagLimit).map((tag, index) => (
                  <Badge key={index} variant="secondary" className="max-w-full whitespace-normal break-all font-medium">{tag}</Badge>
                ))}
                {tags.length > tagLimit && <Badge variant="outline">+{tags.length - tagLimit}</Badge>}
              </div>
            )}
            <div className={cn('pt-2', fullPage && 'max-w-md')}>
              {isAvailabilityLoading ? (
                <div role="status" className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                  <span className="size-4 shrink-0 animate-pulse rounded-full bg-muted-foreground/30" aria-hidden="true" />
                  <p className="text-sm font-semibold text-muted-foreground">Checking availability…</p>
                </div>
              ) : (
                <>
                  <StatusBanner book={book} availability={availability} variant="compact" />
                  {outOfService > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">{borrowed} borrowed · {outOfService} unavailable</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end">
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-4">
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">Shelf location</dt>
            <dd className="mt-0.5 break-words text-sm font-medium">{book.location || 'Main Floor'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">Section</dt>
            <dd className="mt-0.5 break-words text-sm font-medium">{book.section || 'General'}</dd>
          </div>
        </dl>
        {actions}
      </div>

      <section aria-label="Description">
        <h3 className="text-sm font-semibold">Description</h3>
        <p className="mt-1 max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {book.description || 'No description available.'}
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
        {[
          { label: 'ISBN', value: book.isbn || 'N/A' },
          { label: 'DDC', value: book.dewey_decimal || 'N/A' },
          { label: 'Category', value: categoryName || 'Uncategorized' },
        ].map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
