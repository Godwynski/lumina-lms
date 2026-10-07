export type UserRole = 'super_admin' | 'librarian' | 'student_assistant' | 'student';

export type UserPermissions = {
  manage_circulation?: boolean;
  manage_attendance?: boolean;
  view_admin_dashboard?: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "super_admin" | "librarian" | "student_assistant" | "student";
  status: string;
  department: string;
  joined: string;
  student_id: string | null;
  address: string | null;
  phone: string | null;
  updatedAt: string | null;
  onboarding_completed?: boolean;
  library_card?: {
    card_number: string;
    status: string;
    expires_at?: string | null;
  } | null;
  permissions?: Record<string, boolean>;
};

export interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  cover_url?: string;
  section?: string;
  location?: string;
  category_id?: string | null;
  description?: string | null;
  published_year?: number | null;
  total_copies?: number;
  available_copies: number;
  is_active?: boolean;
  categories?: {
    name: string;
  } | {
    name: string;
  }[];
  tags?: string[];
  dewey_decimal?: string;
  created_at?: string;
}

export type BookCopyStatus = 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST' | 'RESERVED';

export interface BookCopy {
  id: string;
  book_id: string;
  status: BookCopyStatus;
  qr_string: string;
  accession_number: string;
  condition?: string;
  created_at: string;
}

export interface ReservationReserver {
  id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
}

export type ReservationStatus = 'ACTIVE' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface CopyReservation {
  id: string;
  status: ReservationStatus;
  queue_position: number;
  hold_expires_at: string | null;
  profiles: ReservationReserver | null;
}

export interface BookCopyWithReservation extends Omit<BookCopy, 'status'> {
  status: BookCopyStatus;
  reservation: CopyReservation | null;
}

export interface Reservation {
  id: string;
  status: ReservationStatus;
  queue_position: number;
  hold_expires_at: string | null;
  books: {
    id: string;
    title: string;
    cover_url: string | null;
  } | null;
}

export type ProfileData = {
  id: string;
  full_name: string | null;
  email?: string | null;
  role?: UserRole;
  student_id: string | null;
  department: string | null;
  avatar_url: string | null;
  address: string | null;
  phone: string | null;
  status?: string;
  updated_at?: string | null;
  created_at?: string;
  onboarding_completed?: boolean;
  permissions?: UserPermissions | null;
};

