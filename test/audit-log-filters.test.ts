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
    ['subject_student_id', params.get('studentId')], ['admin_id', params.get('userId')],
  ]);
  expect(builder.or).toHaveBeenCalledWith(`subject_book_id.eq.${params.get('bookId')},details->bookIds.cs.${JSON.stringify([params.get('bookId')])}`);
  expect(builder.or).toHaveBeenCalledWith(`subject_copy_id.eq.${params.get('copyId')},details->copyIds.cs.${JSON.stringify([params.get('copyId')])}`);
  expect(builder.in).toHaveBeenCalledWith('entity_type', ['book', 'books']);
  expect(builder.gte).toHaveBeenCalledWith('created_at', '2026-11-01T00:00:00+08:00');
  expect(builder.lte).toHaveBeenCalledWith('created_at', '2026-11-13T23:59:59.999+08:00');
  expect(builder.or).toHaveBeenCalledWith('action.ilike.create%,action.ilike.insert%,action.ilike.%created');
  const screenFilters = [...builder.eq.mock.calls];
  const screenAlternatives = [...builder.or!.mock.calls];
  builder.eq.mockClear();
  builder.or!.mockClear();
  auditLogQuery(client, params);
  expect(builder.eq.mock.calls).toEqual(screenFilters);
  expect(builder.or!.mock.calls).toEqual(screenAlternatives);
});

it.each<Record<string, string>>([{ bookId: 'not-a-uuid' }, { limit: '99999' }, { offset: '-1' }, { sort: 'reason-asc' }, { startDate: '2026-11-13', endDate: '2026-11-01' }])('rejects invalid filters %j', filters => {
  expect(() => parseAuditFilters(new URLSearchParams(filters))).toThrow();
});

it.each([[undefined, false], ['oldest', true], ['newest', false]] as const)('orders audit timestamps and ties consistently for %s', (sort, ascending) => {
  const helper = createMockSupabaseClient();
  const params = new URLSearchParams({ actionType: 'create' });
  if (sort) params.set('sort', sort);
  auditLogQuery(helper.client as unknown as SupabaseClient, params, true).range(20, 39);
  const query = helper.getTableBuilder('audit_log_records');
  expect(query.or).toHaveBeenCalledWith('action.ilike.create%,action.ilike.insert%,action.ilike.%created');
  expect(query.order.mock.calls).toEqual([['created_at', { ascending }], ['id', { ascending }]]);
  expect(query.order.mock.invocationCallOrder.at(-1)).toBeLessThan(query.range.mock.invocationCallOrder[0]);
  expect(query.range).toHaveBeenCalledExactlyOnceWith(20, 39);
});

it('quotes search punctuation and treats wildcards literally', () => {
  expect(auditSearchPattern('neri.376375@alabang.sti.edu.ph')).toBe('"%neri.376375@alabang.sti.edu.ph%"');
  expect(JSON.parse(auditSearchPattern('Neri, "Godwyn"'))).toBe('%Neri, "Godwyn"%');
  expect(JSON.parse(auditSearchPattern('100%_match'))).toBe('%100\\%\\_match%');
});
