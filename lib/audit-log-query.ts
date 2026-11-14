import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { sanitizeFilterInput } from '@/lib/utils';

// PostgREST quoted values preserve punctuation in names/emails without adding filter operators.
export function auditSearchPattern(input: string) {
  return JSON.stringify(`%${input.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
}

const filtersSchema = z.object({
  bookId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  copyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).refine(v => !v.startDate || !v.endDate || v.startDate <= v.endDate, 'Start date must precede end date.');

export function parseAuditFilters(params: URLSearchParams) {
  return filtersSchema.parse(Object.fromEntries(params));
}

/** Screen and exports must interpret the same filters identically. */
export function auditLogQuery(supabase: SupabaseClient, params: URLSearchParams, count = false) {
  const filters = parseAuditFilters(params);
  let query = supabase.from('audit_log_records').select('*', count ? { count: 'exact' } : undefined)
    .order('created_at', { ascending: false }).order('id', { ascending: false });
  const entity = params.get('entityType');
  if (entity && entity !== 'all') {
    const aliases: Record<string, string[]> = {
      book: ['book', 'books'], book_copy: ['book_copy', 'book_copies'],
      borrowing_record: ['borrowing_record', 'borrowing_records'],
      reservation: ['reservation', 'reservations'], profile: ['profile', 'profiles'],
      library_card: ['library_card', 'library_cards'], policy: ['policy', 'settings', 'system_settings'],
    };
    query = query.in('entity_type', aliases[entity] || [entity]);
  }
  const action = params.get('actionType');
  if (action && action !== 'all') {
    const groups: Record<string, string> = {
      create: 'action.ilike.create%,action.ilike.insert%,action.ilike.%created',
      update: 'action.ilike.update%,action.ilike.%updated',
      archive: 'action.ilike.archive%,action.ilike.%archived,action.ilike.delete%',
      login: 'action.ilike.login%,action.ilike.%onboarding%,action.ilike.%role%',
    };
    query = groups[action] ? query.or(groups[action]) : query.ilike('action', `%${sanitizeFilterInput(action === 'issuance' ? 'issuan' : action)}%`);
  }
  if (filters.bookId) query = query.eq('subject_book_id', filters.bookId);
  if (filters.studentId) query = query.eq('subject_student_id', filters.studentId);
  if (filters.copyId) query = query.eq('subject_copy_id', filters.copyId);
  if (filters.userId) query = query.eq('admin_id', filters.userId);
  if (filters.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00+08:00`);
  if (filters.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59.999+08:00`);
  const term = (params.get('query') || '').trim().slice(0, 150);
  if (term) query = query.or(['entity_type', 'action', 'reason', 'actor_name', 'actor_email', 'book_title', 'book_isbn', 'copy_barcode', 'copy_accession', 'student_name', 'student_number', 'student_email'].map(field => `${field}.ilike.${auditSearchPattern(term)}`).join(','));
  return query;
}
