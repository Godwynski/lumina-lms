export interface BookDetail {
  id: string;
  title: string;
  author: string;
  description?: string | null;
  isbn: string | null;
  cover_url: string | null;
  section: string | null;
  location: string | null;
  available_copies: number;
  total_copies: number;
  categories: { name?: string } | { name?: string }[] | null;
  tags: string[] | null;
  dewey_decimal?: string | null;
}

export interface AvailabilityStatus {
  nextAvailableDate: string | null;
  hasReservation: boolean;
  isReady: boolean;
  queuePosition: number | null;
  holdExpiresAt: string | null;
  reservationId: string | null;
  /** Copies in MAINTENANCE or LOST. */
  outOfServiceCount?: number;
}

/** No copy on the shelf and none on loan: every copy is in repair or lost, so a waitlist would never move. */
export function isOutOfService(
  book: Pick<BookDetail, 'available_copies' | 'total_copies'>,
  availability: Pick<AvailabilityStatus, 'outOfServiceCount'>
): boolean {
  const out = availability.outOfServiceCount ?? 0;
  return book.available_copies <= 0 && out > 0 && book.total_copies - out <= 0;
}
