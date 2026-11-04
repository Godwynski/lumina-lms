/**
 * Canonical PostgreSQL / Supabase Database Type Definitions for Lumina LMS.
 * 
 * Provides end-to-end type safety for all 20 public tables, custom enums,
 * and database RPC functions in alignment with `supabase/schema_clean_install.sql`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* -------------------------------------------------------------------------- */
/* Database Enums                                                             */
/* -------------------------------------------------------------------------- */

export type UserRole = 'super_admin' | 'librarian' | 'student' | 'student_assistant';
export type BorrowStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'LOST';
export type ReservationStatus = 'ACTIVE' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export type BookCopyStatus = 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST' | 'RESERVED';
export type ProfileStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'GRADUATED' | 'DELETED' | 'ARCHIVED';
export type LibraryCardStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'ARCHIVED';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationType = 'SYSTEM' | 'CIRCULATION' | 'RESERVATION' | 'OVERDUE' | 'ACCOUNT' | 'DUE_SOON' | 'RESERVATION_EXPIRED' | 'GENERAL';

/* -------------------------------------------------------------------------- */
/* Table Row Types (All 14 Public Tables)                                     */
/* -------------------------------------------------------------------------- */

export interface CategoriesRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BooksRow {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category_id: string | null;
  cover_url: string | null;
  tags: string[];
  location: string | null;
  section: string | null;
  total_copies: number;
  available_copies: number;
  is_active: boolean;
  dewey_decimal: string | null;
  description: string | null;
  published_year: number | null;
  search_vector?: unknown;
  created_at: string;
  updated_at: string;
}

export interface BookCopiesRow {
  id: string;
  book_id: string;
  qr_string: string;
  status: BookCopyStatus;
  condition: string | null;
  created_at: string;
  updated_at: string;
  accession_number: string;
}

export interface ProfilesRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  student_id: string | null;
  department: string | null;
  phone: string | null;
  address: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
  permissions: Json;
}

export interface LibraryCardsRow {
  id: string;
  user_id: string;
  card_number: string;
  status: LibraryCardStatus;
  issued_at: string;
  expires_at: string | null;
  updated_at: string;
}

export interface BorrowingRecordsRow {
  id: string;
  user_id: string;
  book_copy_id: string;
  processed_by: string | null;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: BorrowStatus;
  returned_by: string | null;
  reminder_sent: boolean;
  overdue_notified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReservationsRow {
  id: string;
  user_id: string;
  book_id: string;
  copy_id: string | null;
  status: ReservationStatus;
  queue_position: number;
  reserved_at: string;
  hold_expires_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemSettingsRow {
  id: string;
  key: string;
  value: string;
  description: string | null;
  data_type: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditLogsRow {
  id: string;
  admin_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_value: Json | null;
  new_value: Json | null;
  reason: string | null;
  created_at: string;
  details: Json;
}

export interface CheckoutIdempotencyRow {
  id: string;
  idempotency_key: string;
  response: Json;
  created_at: string;
}

export interface ReturnIdempotencyRow {
  id: string;
  idempotency_key: string;
  response: Json;
  created_at: string;
}

export interface NotificationsRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: NotificationType;
  priority: NotificationPriority;
  is_read: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: string;
  user_id: string;
  check_in_at: string;
  check_out_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface UiPreferencesRow {
  id: string;
  user_id: string;
  preferences: Json;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Complete Database Client Interface                                         */
/* -------------------------------------------------------------------------- */

export interface Database {
  public: {
    Tables: {
      categories: { Row: CategoriesRow; Insert: Partial<CategoriesRow>; Update: Partial<CategoriesRow> };
      books: { Row: BooksRow; Insert: Partial<BooksRow>; Update: Partial<BooksRow> };
      book_copies: { Row: BookCopiesRow; Insert: Partial<BookCopiesRow>; Update: Partial<BookCopiesRow> };
      profiles: { Row: ProfilesRow; Insert: Partial<ProfilesRow>; Update: Partial<ProfilesRow> };
      library_cards: { Row: LibraryCardsRow; Insert: Partial<LibraryCardsRow>; Update: Partial<LibraryCardsRow> };
      borrowing_records: { Row: BorrowingRecordsRow; Insert: Partial<BorrowingRecordsRow>; Update: Partial<BorrowingRecordsRow> };
      reservations: { Row: ReservationsRow; Insert: Partial<ReservationsRow>; Update: Partial<ReservationsRow> };
      system_settings: { Row: SystemSettingsRow; Insert: Partial<SystemSettingsRow>; Update: Partial<SystemSettingsRow> };
      audit_logs: { Row: AuditLogsRow; Insert: Partial<AuditLogsRow>; Update: Partial<AuditLogsRow> };
      checkout_idempotency: { Row: CheckoutIdempotencyRow; Insert: Partial<CheckoutIdempotencyRow>; Update: Partial<CheckoutIdempotencyRow> };
      return_idempotency: { Row: ReturnIdempotencyRow; Insert: Partial<ReturnIdempotencyRow>; Update: Partial<ReturnIdempotencyRow> };
      notifications: { Row: NotificationsRow; Insert: Partial<NotificationsRow>; Update: Partial<NotificationsRow> };
      attendance: { Row: AttendanceRow; Insert: Partial<AttendanceRow>; Update: Partial<AttendanceRow> };
      ui_preferences: { Row: UiPreferencesRow; Insert: Partial<UiPreferencesRow>; Update: Partial<UiPreferencesRow> };
    };
    Views: Record<string, never>;
    Functions: {
      is_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      process_qr_checkout: {
        Args: {
          p_librarian_id: string;
          p_card_qr: string;
          p_book_qr: string;
          p_idempotency_key?: string | null;
          p_preview_only?: boolean;
        };
        Returns: Json;
      };
      process_qr_return: {
        Args: {
          p_librarian_id: string;
          p_book_qr: string;
          p_idempotency_key?: string | null;
          p_preview_only?: boolean;
        };
        Returns: Json;
      };
      create_reservation_atomic: {
        Args: {
          p_actor_id: string;
          p_book_id: string;
          p_target_user_id?: string | null;
        };
        Returns: Json;
      };
      compress_reservation_queue: {
        Args: {
          p_book_id: string;
        };
        Returns: void;
      };
      transfer_super_admin_ownership: {
        Args: {
          p_current_admin_id: string;
          p_new_admin_id: string;
        };
        Returns: void;
      };
      auto_checkout_forgotten_attendance: {
        Args: Record<string, never>;
        Returns: number;
      };
      release_copy: {
        Args: {
          p_copy_id: string;
        };
        Returns: Json;
      };
      annual_student_reset: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_analytics_summary: {
        Args: {
          p_range?: string;
        };
        Returns: Json;
      };
      send_bulk_notifications_by_target: {
        Args: {
          p_target: string;
          p_title: string;
          p_content: string;
          p_type?: string;
          p_priority?: string;
          p_metadata?: Json;
        };
        Returns: number;
      };
      reactivate_users_bulk: {
        Args: {
          p_user_ids: string[];
        };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      BorrowStatus: BorrowStatus;
      ReservationStatus: ReservationStatus;
    };
  };
}
