export interface BookDetail {
  id: string;
  title: string;
  author: string;
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
}
