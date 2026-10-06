import { describe, it, expect } from 'vitest';
import {
  ROLE_RANKS,
  hasPermission,
  isStaff,
  isAccessBlocked,
  NavItem,
  Profile,
} from './permissions';

describe('ROLE_RANKS hierarchy', () => {
  it('enforces strict rank hierarchy: student (1) < student_assistant (2) < librarian (3) < super_admin (4)', () => {
    expect(ROLE_RANKS.student).toBe(1);
    expect(ROLE_RANKS.student_assistant).toBe(2);
    expect(ROLE_RANKS.librarian).toBe(3);
    expect(ROLE_RANKS.super_admin).toBe(4);

    expect(ROLE_RANKS.student).toBeLessThan(ROLE_RANKS.student_assistant);
    expect(ROLE_RANKS.student_assistant).toBeLessThan(ROLE_RANKS.librarian);
    expect(ROLE_RANKS.librarian).toBeLessThan(ROLE_RANKS.super_admin);
  });
});

describe('hasPermission', () => {
  const baseItem: NavItem = {
    href: '/catalog',
    label: 'Catalog',
  };

  it('denies access if userRole is null and item requires a minimum role', () => {
    const item: NavItem = { ...baseItem, minRole: 'student' };
    expect(hasPermission(null, item)).toBe(false);
  });

  describe('Rank-based authorization', () => {
    it('grants access when user rank is equal to minRole', () => {
      const studentItem: NavItem = { ...baseItem, minRole: 'student' };
      const saItem: NavItem = { ...baseItem, minRole: 'student_assistant' };
      const librarianItem: NavItem = { ...baseItem, minRole: 'librarian' };
      const adminItem: NavItem = { ...baseItem, minRole: 'super_admin' };

      expect(hasPermission('student', studentItem)).toBe(true);
      expect(hasPermission('student_assistant', saItem, { status: 'ACTIVE' })).toBe(true);
      expect(hasPermission('librarian', librarianItem)).toBe(true);
      expect(hasPermission('super_admin', adminItem)).toBe(true);
    });

    it('grants access when user rank is higher than minRole', () => {
      const studentItem: NavItem = { ...baseItem, minRole: 'student' };
      const saItem: NavItem = { ...baseItem, minRole: 'student_assistant' };

      expect(hasPermission('student_assistant', studentItem, { status: 'ACTIVE' })).toBe(true);
      expect(hasPermission('librarian', studentItem)).toBe(true);
      expect(hasPermission('super_admin', studentItem)).toBe(true);

      expect(hasPermission('librarian', saItem)).toBe(true);
      expect(hasPermission('super_admin', saItem)).toBe(true);
    });

    it('denies access when user rank is lower than minRole', () => {
      const saItem: NavItem = { ...baseItem, minRole: 'student_assistant' };
      const librarianItem: NavItem = { ...baseItem, minRole: 'librarian' };
      const adminItem: NavItem = { ...baseItem, minRole: 'super_admin' };

      expect(hasPermission('student', saItem)).toBe(false);
      expect(hasPermission('student', librarianItem)).toBe(false);
      expect(hasPermission('student', adminItem)).toBe(false);

      expect(hasPermission('student_assistant', librarianItem, { status: 'ACTIVE' })).toBe(false);
      expect(hasPermission('student_assistant', adminItem, { status: 'ACTIVE' })).toBe(false);

      expect(hasPermission('librarian', adminItem)).toBe(false);
    });
  });

  describe('excludeRoles (blacklist)', () => {
    it('denies access if userRole is listed in excludeRoles even with higher rank', () => {
      const item: NavItem = {
        ...baseItem,
        minRole: 'student',
        excludeRoles: ['super_admin', 'librarian'],
      };

      expect(hasPermission('student', item)).toBe(true);
      expect(hasPermission('super_admin', item)).toBe(false);
      expect(hasPermission('librarian', item)).toBe(false);
    });
  });

  describe('exactRoles (whitelist)', () => {
    it('grants access immediately if userRole is in exactRoles', () => {
      const item: NavItem = {
        ...baseItem,
        exactRoles: ['student', 'student_assistant'],
      };

      expect(hasPermission('student', item)).toBe(true);
      expect(hasPermission('student_assistant', item, { status: 'ACTIVE' })).toBe(true);
      expect(hasPermission('librarian', item)).toBe(false);
      expect(hasPermission('super_admin', item)).toBe(false);
    });

    it('falls back to minRole check if exactRoles does not match but minRole is specified', () => {
      const item: NavItem = {
        ...baseItem,
        exactRoles: ['student'],
        minRole: 'librarian',
      };

      // Exact match for student passes
      expect(hasPermission('student', item)).toBe(true);
      // Librarian does not match exactRoles ['student'], but meets minRole 'librarian'
      expect(hasPermission('librarian', item)).toBe(true);
      expect(hasPermission('super_admin', item)).toBe(true);
      // SA does not match exactRoles and rank (2) is below minRole (3)
      expect(hasPermission('student_assistant', item, { status: 'ACTIVE' })).toBe(false);
    });

    it('denies access if exactRoles specified without minRole and role does not match', () => {
      const item: NavItem = {
        ...baseItem,
        exactRoles: ['super_admin'],
      };

      expect(hasPermission('super_admin', item)).toBe(true);
      expect(hasPermission('librarian', item)).toBe(false);
      expect(hasPermission('student_assistant', item)).toBe(false);
      expect(hasPermission('student', item)).toBe(false);
    });
  });

  describe('Granular Student Assistant permissions', () => {
    it('grants SA access when profile has the specific permission set to true', () => {
      const circulationItem: NavItem = {
        ...baseItem,
        minRole: 'student_assistant',
        permissionKey: 'manage_circulation',
      };
      const attendanceItem: NavItem = {
        ...baseItem,
        minRole: 'student_assistant',
        permissionKey: 'manage_attendance',
      };
      const dashboardItem: NavItem = {
        ...baseItem,
        minRole: 'student_assistant',
        permissionKey: 'view_admin_dashboard',
      };

      const profileWithCirculation: Profile = {
        status: 'ACTIVE',
        permissions: { manage_circulation: true },
      };
      const profileWithAttendance: Profile = {
        status: 'ACTIVE',
        permissions: { manage_attendance: true },
      };
      const profileWithDashboard: Profile = {
        status: 'ACTIVE',
        permissions: { view_admin_dashboard: true },
      };

      expect(hasPermission('student_assistant', circulationItem, profileWithCirculation)).toBe(true);
      expect(hasPermission('student_assistant', attendanceItem, profileWithAttendance)).toBe(true);
      expect(hasPermission('student_assistant', dashboardItem, profileWithDashboard)).toBe(true);
    });

    it('denies SA access when profile lacks the required permission', () => {
      const circulationItem: NavItem = {
        ...baseItem,
        minRole: 'student_assistant',
        permissionKey: 'manage_circulation',
      };

      const profileWithoutCirculation: Profile = {
        status: 'ACTIVE',
        permissions: { manage_attendance: true, manage_circulation: false },
      };
      const profileWithNoPermissions: Profile = {
        status: 'ACTIVE',
        permissions: null,
      };

      expect(hasPermission('student_assistant', circulationItem, profileWithoutCirculation)).toBe(false);
      expect(hasPermission('student_assistant', circulationItem, profileWithNoPermissions)).toBe(false);
      expect(hasPermission('student_assistant', circulationItem, null)).toBe(false);
    });

    it('bypasses granular permission checks for super_admin and librarian', () => {
      const circulationItem: NavItem = {
        ...baseItem,
        minRole: 'student_assistant',
        permissionKey: 'manage_circulation',
      };

      // Even with empty profile or no permissions object, admin and librarian bypass
      expect(hasPermission('super_admin', circulationItem, null)).toBe(true);
      expect(hasPermission('super_admin', circulationItem, { permissions: {} })).toBe(true);
      expect(hasPermission('librarian', circulationItem, null)).toBe(true);
      expect(hasPermission('librarian', circulationItem, { permissions: {} })).toBe(true);
    });
  });

  describe('Deactivated Student Assistant guard', () => {
    const activeSAProfile: Profile = { status: 'ACTIVE', permissions: { manage_circulation: true } };
    const inactiveSAProfile: Profile = { status: 'INACTIVE', permissions: { manage_circulation: true } };
    const suspendedSAProfile: Profile = { status: 'SUSPENDED', permissions: { manage_circulation: true } };

    it('denies deactivated SA access to staff-level navigation items', () => {
      const staffItem: NavItem = { ...baseItem, minRole: 'student_assistant' };

      expect(hasPermission('student_assistant', staffItem, activeSAProfile)).toBe(true);
      expect(hasPermission('student_assistant', staffItem, inactiveSAProfile)).toBe(false);
      expect(hasPermission('student_assistant', staffItem, suspendedSAProfile)).toBe(false);
    });

    it('denies deactivated SA access to items with permissionKey even if permission flag is true', () => {
      const permItem: NavItem = {
        ...baseItem,
        minRole: 'student',
        permissionKey: 'manage_circulation',
      };

      expect(hasPermission('student_assistant', permItem, activeSAProfile)).toBe(true);
      expect(hasPermission('student_assistant', permItem, inactiveSAProfile)).toBe(false);
    });

    it('permits deactivated SA access to general student nav items with minRole=student and no permissionKey', () => {
      const studentItem: NavItem = { ...baseItem, minRole: 'student' };

      expect(hasPermission('student_assistant', studentItem, inactiveSAProfile)).toBe(true);
      expect(hasPermission('student_assistant', studentItem, suspendedSAProfile)).toBe(true);
    });
  });
});

describe('isStaff helper', () => {
  it('returns true for super_admin and librarian regardless of profile status', () => {
    expect(isStaff('super_admin', null)).toBe(true);
    expect(isStaff('super_admin', { status: 'INACTIVE' })).toBe(true);
    expect(isStaff('librarian', null)).toBe(true);
    expect(isStaff('librarian', { status: 'INACTIVE' })).toBe(true);
  });

  it('returns true for active student assistant', () => {
    expect(isStaff('student_assistant', { status: 'ACTIVE' })).toBe(true);
    expect(isStaff('student_assistant', { status: 'active' })).toBe(true);
  });

  it('returns false for inactive, suspended, or pending student assistant', () => {
    expect(isStaff('student_assistant', { status: 'INACTIVE' })).toBe(false);
    expect(isStaff('student_assistant', { status: 'SUSPENDED' })).toBe(false);
    expect(isStaff('student_assistant', { status: 'PENDING' })).toBe(false);
    expect(isStaff('student_assistant', null)).toBe(false);
    expect(isStaff('student_assistant', {})).toBe(false);
  });

  it('returns false for student role even if status is active', () => {
    expect(isStaff('student', { status: 'ACTIVE' })).toBe(false);
    expect(isStaff('student', null)).toBe(false);
  });

  it('returns false for null role', () => {
    expect(isStaff(null, { status: 'ACTIVE' })).toBe(false);
  });
});

describe('isAccessBlocked helper', () => {
  it('returns true for PENDING, SUSPENDED, and INACTIVE accounts', () => {
    expect(isAccessBlocked({ status: 'PENDING' })).toBe(true);
    expect(isAccessBlocked({ status: 'SUSPENDED' })).toBe(true);
    expect(isAccessBlocked({ status: 'INACTIVE' })).toBe(true);
  });

  it('returns false for ACTIVE accounts', () => {
    expect(isAccessBlocked({ status: 'ACTIVE' })).toBe(false);
  });

  it('returns false for null or undefined profile or unspecified status', () => {
    expect(isAccessBlocked(null)).toBe(false);
    expect(isAccessBlocked(undefined)).toBe(false);
    expect(isAccessBlocked({})).toBe(false);
  });
});
