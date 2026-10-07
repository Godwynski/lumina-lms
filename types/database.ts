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
export type BorrowStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE';
export type ReservationStatus = 'ACTIVE' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export type BookCopyStatus = 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST' | 'RESERVED';
export type ProfileStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'GRADUATED' | 'DELETED' | 'ARCHIVED';
export type LibraryCardStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'ARCHIVED';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationType = 'SYSTEM' | 'CIRCULATION' | 'RESERVATION' | 'OVERDUE' | 'ACCOUNT' | 'DUE_SOON' | 'RESERVATION_EXPIRED' | 'GENERAL';
export type AnnouncementPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

/* -------------------------------------------------------------------------- */
/* Table Row Types (All 20 Public Tables)                                     */
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

export interface AnnouncementsRow {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  is_active: boolean;
  target_role: UserRole | null;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ReportsRow {
  id: string;
  book_id: string | null;
  user_id: string | null;
  notes: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export interface DeletedProfileInfoRow {
  id: string;
  original_profile_id: string | null;
  anonymized_at: string;
  deletion_reason: string | null;
  retained_borrow_count: number;
}

export interface RateLimitLogRow {
  id: string;
  user_id: string;
  action_key: string;
  created_at: string;
}

export interface ChecklistDropdownOptionsRow {
  id: string;
  type: string;
  value: string;
  created_at: string;
}

export interface ChecklistItemsRow {
  id: string;
  problem: string;
  explanation: string | null;
  user_role: string | null;
  module: string | null;
  is_completed: boolean;
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
      announcements: { Row: AnnouncementsRow; Insert: Partial<AnnouncementsRow>; Update: Partial<AnnouncementsRow> };
      reports: { Row: ReportsRow; Insert: Partial<ReportsRow>; Update: Partial<ReportsRow> };
      deleted_profile_info: { Row: DeletedProfileInfoRow; Insert: Partial<DeletedProfileInfoRow>; Update: Partial<DeletedProfileInfoRow> };
      rate_limit_log: { Row: RateLimitLogRow; Insert: Partial<RateLimitLogRow>; Update: Partial<RateLimitLogRow> };
      checklist_dropdown_options: { Row: ChecklistDropdownOptionsRow; Insert: Partial<ChecklistDropdownOptionsRow>; Update: Partial<ChecklistDropdownOptionsRow> };
      checklist_items: { Row: ChecklistItemsRow; Insert: Partial<ChecklistItemsRow>; Update: Partial<ChecklistItemsRow> };
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
    };
    Enums: {
      user_role: UserRole;
      BorrowStatus: BorrowStatus;
      ReservationStatus: ReservationStatus;
    };
  };
}
