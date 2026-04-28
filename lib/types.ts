export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  cover_url?: string;
  section?: string;
  location?: string;
  total_copies?: number;
  available_copies: number;
  is_active?: boolean;
  categories?: {
    name: string;
  } | {
    name: string;
  }[];
  tags?: string[];
  created_at?: string;
}

interface BookCopy {
  id: string;
  book_id: string;
  status: 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST' | 'RESERVED';
  qr_string: string;
  condition?: string;
  created_at: string;
}

interface ReservationReserver {
  id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
}

interface CopyReservation {
  id: string;
  status: 'ACTIVE' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  queue_position: number;
  hold_expires_at: string | null;
  profiles: ReservationReserver | null;
}

export interface BookCopyWithReservation extends Omit<BookCopy, 'status'> {
  status: 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST' | 'RESERVED';
  reservation: CopyReservation | null;
}

export interface Reservation {
  id: string;
  status: string;
  queue_position: number;
  hold_expires_at: string | null;
  books: {
    id: string;
    title: string;
    cover_url: string | null;
  } | null;
}

export type ProfileData = {
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  avatar_url: string | null;
  address: string | null;
  phone: string | null;
};

