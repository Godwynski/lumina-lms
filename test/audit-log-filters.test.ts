import { expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { auditLogQuery, auditSearchPattern, parseAuditFilters } from '@/lib/audit-log-query';
import { createMockSupabaseClient } from '@/test/mocks/supabase';

it('combines exact subject, actor, date and action filters identically for screen and export', () => {
  const helper = createMockSupabaseClient();
  const client = helper.client as unknown as SupabaseClient;
  const params = new URLSearchParams({ bookId: '00000000-0000-4000-8000-000000000001', studentId: '00000000-0000-4000-8000-000000000002', copyId: '00000000-0000-4000-8000-000000000003', userId: '00000000-0000-4000-8000-000000000004', actionType: 'create', entityType: 'book', startDate: '2026-11-01', endDate: '2026-11-13' });
  auditLogQuery(client, params, true);
  const builder = helper.getTableBuilder('audit_log_records');
  expect(builder.eq.mock.calls).toEqual([
    ['subject_book_id', params.get('bookId')], ['subject_student_id', params.get('studentId')],
    ['subject_copy_id', params.get('copyId')], ['admin_id', params.get('userId')],
  ]);
  expect(builder.in).toHaveBeenCalledWith('entity_type', ['book', 'books']);
  expect(builder.gte).toHaveBeenCalledWith('created_at', '2026-11-01T00:00:00+08:00');
  expect(builder.lte).toHaveBeenCalledWith('created_at', '2026-11-13T23:59:59.999+08:00');
  expect(builder.or).toHaveBeenCalledWith('action.ilike.create%,action.ilike.insert%,action.ilike.%created');
  const screenFilters = [...builder.eq.mock.calls];
  builder.eq.mockClear();
  auditLogQuery(client, params);
  expect(builder.eq.mock.calls).toEqual(screenFilters);
});

it.each<Record<string, string>>([{ bookId: 'not-a-uuid' }, { limit: '99999' }, { offset: '-1' }, { startDate: '2026-11-13', endDate: '2026-11-01' }])('rejects invalid filters %j', filters => {
  expect(() => parseAuditFilters(new URLSearchParams(filters))).toThrow();
});

it('quotes search punctuation and treats wildcards literally', () => {
  expect(auditSearchPattern('neri.376375@alabang.sti.edu.ph')).toBe('"%neri.376375@alabang.sti.edu.ph%"');
  expect(JSON.parse(auditSearchPattern('Neri, "Godwyn"'))).toBe('%Neri, "Godwyn"%');
  expect(JSON.parse(auditSearchPattern('100%_match'))).toBe('%100\\%\\_match%');
});
