import { describe, it, expect } from 'vitest';
import { getReportDatasets } from '@/lib/auth/report-access';
import type { Profile } from '@/lib/auth/permissions';

const profile = (status: string, permissions: Record<string, boolean> = {}) =>
  ({ status, permissions }) as unknown as Profile;
const ALL = ['attendance', 'borrowing', 'inventory', 'users'];

describe('getReportDatasets', () => {
  it('gives librarians and super admins every dataset', () => {
    expect(getReportDatasets('librarian', profile('ACTIVE'))).toEqual(ALL);
    expect(getReportDatasets('super_admin', profile('ACTIVE'))).toEqual(ALL);
    expect(getReportDatasets('super_admin', null)).toEqual(ALL);
  });

  it('gives library staff nothing, even with every delegated permission', () => {
    const full = profile('ACTIVE', { manage_attendance: true, manage_circulation: true, manage_inventory: true, view_admin_dashboard: true });
    expect(getReportDatasets('library_staff', full)).toEqual([]);
    expect(getReportDatasets('library_staff', null)).toEqual([]);
  });

  it('gives patrons nothing', () => {
    expect(getReportDatasets('patron', profile('ACTIVE'))).toEqual([]);
  });

  it('blocks suspended or pending managers', () => {
    expect(getReportDatasets('librarian', profile('SUSPENDED'))).toEqual([]);
    expect(getReportDatasets('super_admin', profile(' pending '))).toEqual([]);
  });
});
