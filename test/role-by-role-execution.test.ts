import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  isStaff,
  isAccessBlocked,
  ROLE_RANKS,
  NavItem,
  Profile,
  Role,
} from '@/lib/auth/permissions';

const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', minRole: 'student' },
  { href: '/student-catalog', label: 'Catalog', minRole: 'student', excludeRoles: ['super_admin', 'librarian'] },
  { href: '/inventory', label: 'Inventory', minRole: 'student_assistant', permissionKey: 'view_admin_dashboard' },
  { href: '/circulation', label: 'Circulation Desk', minRole: 'student_assistant', permissionKey: 'manage_circulation' },
  { href: '/history', label: 'Borrow History', minRole: 'student' },
  { href: '/analytics', label: 'Analytics', minRole: 'librarian', permissionKey: 'view_admin_dashboard' },
  { href: '/users', label: 'User Directory', minRole: 'librarian', permissionKey: 'view_admin_dashboard' },
  { href: '/attendance', label: 'Attendance Logs', minRole: 'student' },
  { href: '/policies', label: 'Settings & Policies', minRole: 'librarian', permissionKey: 'view_admin_dashboard' },
  { href: '/audit', label: 'Audit Logs', minRole: 'super_admin', permissionKey: 'view_admin_dashboard' },
];

describe('Exhaustive Role-By-Role Testing Suite', () => {
  describe('ROLE 1: Super Admin (Clearance Level 4 / Root)', () => {
    const role: Role = 'super_admin';
    const profile: Profile = {
      full_name: 'System Super Administrator',
      status: 'ACTIVE',
      role: 'super_admin',
      permissions: {
        manage_circulation: true,
        manage_attendance: true,
        view_admin_dashboard: true,
      },
    };

    it('identifies Super Admin as staff with top rank (4)', () => {
      expect(ROLE_RANKS[role]).toBe(4);
      expect(isStaff(role, profile)).toBe(true);
      expect(isAccessBlocked(profile)).toBe(false);
    });

    it('has full access to Administrative & Staff Modules', () => {
      const allowedPaths = [
        '/dashboard',
        '/inventory',
        '/circulation',
        '/history',
        '/analytics',
        '/users',
        '/attendance',
        '/policies',
        '/audit',
      ];

      for (const path of allowedPaths) {
        const item = ALL_NAV_ITEMS.find((n) => n.href === path)!;
        expect(hasPermission(role, item, profile)).toBe(true);
      }
    });

    it('is excluded from student-catalog view (uses staff inventory instead)', () => {
      const catalog = ALL_NAV_ITEMS.find((n) => n.href === '/student-catalog')!;
      expect(hasPermission(role, catalog, profile)).toBe(false);
    });

    it('has exclusive access to Audit Logs', () => {
      const audit = ALL_NAV_ITEMS.find((n) => n.href === '/audit')!;
      expect(hasPermission(role, audit, profile)).toBe(true);
    });
  });

  describe('ROLE 2: Librarian (Clearance Level 3 / Lead Staff)', () => {
    const role: Role = 'librarian';
    const profile: Profile = {
      full_name: 'Head Librarian',
      status: 'ACTIVE',
      role: 'librarian',
      permissions: {
        manage_circulation: true,
        manage_attendance: true,
        view_admin_dashboard: true,
      },
    };

    it('identifies Librarian as staff with rank 3', () => {
      expect(ROLE_RANKS[role]).toBe(3);
      expect(isStaff(role, profile)).toBe(true);
      expect(isAccessBlocked(profile)).toBe(false);
    });

    it('has access to operational and management modules', () => {
      const allowedPaths = [
        '/dashboard',
        '/inventory',
        '/circulation',
        '/history',
        '/analytics',
        '/users',
        '/attendance',
        '/policies',
      ];

      for (const path of allowedPaths) {
        const item = ALL_NAV_ITEMS.find((n) => n.href === path)!;
        expect(hasPermission(role, item, profile)).toBe(true);
      }
    });

    it('is strictly blocked from Audit Logs (Super Admin only)', () => {
      const audit = ALL_NAV_ITEMS.find((n) => n.href === '/audit')!;
      expect(hasPermission(role, audit, profile)).toBe(false);
    });

    it('is excluded from student-catalog view (uses staff inventory)', () => {
      const catalog = ALL_NAV_ITEMS.find((n) => n.href === '/student-catalog')!;
      expect(hasPermission(role, catalog, profile)).toBe(false);
    });
  });

  describe('ROLE 3: Student Assistant (Clearance Level 2 / Delegated Staff)', () => {
    const role: Role = 'student_assistant';

    it('Active SA with full permissions: has access to Circulation Desk and Inventory', () => {
      const activeProfile: Profile = {
        full_name: 'Active Student Assistant',
        status: 'ACTIVE',
        role: 'student_assistant',
        permissions: {
          manage_circulation: true,
          manage_attendance: true,
          view_admin_dashboard: true,
        },
      };

      expect(ROLE_RANKS[role]).toBe(2);
      expect(isStaff(role, activeProfile)).toBe(true);

      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/dashboard')!, activeProfile)).toBe(true);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/student-catalog')!, activeProfile)).toBe(true);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/inventory')!, activeProfile)).toBe(true);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/circulation')!, activeProfile)).toBe(true);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/history')!, activeProfile)).toBe(true);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/attendance')!, activeProfile)).toBe(true);

      // Blocked modules
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/analytics')!, activeProfile)).toBe(false);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/users')!, activeProfile)).toBe(false);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/policies')!, activeProfile)).toBe(false);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/audit')!, activeProfile)).toBe(false);
    });

    it('Active SA without manage_circulation permission: blocked from Circulation Desk', () => {
      const limitedProfile: Profile = {
        full_name: 'Catalog-Only SA',
        status: 'ACTIVE',
        role: 'student_assistant',
        permissions: {
          manage_circulation: false,
          manage_attendance: true,
          view_admin_dashboard: true,
        },
      };

      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/circulation')!, limitedProfile)).toBe(false);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/inventory')!, limitedProfile)).toBe(true);
    });

    it('Deactivated / Inactive SA: stripped of all staff privileges', () => {
      const inactiveProfile: Profile = {
        full_name: 'Deactivated SA',
        status: 'INACTIVE',
        role: 'student_assistant',
        permissions: {
          manage_circulation: true,
          manage_attendance: true,
          view_admin_dashboard: true,
        },
      };

      expect(isStaff(role, inactiveProfile)).toBe(false);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/inventory')!, inactiveProfile)).toBe(false);
      expect(hasPermission(role, ALL_NAV_ITEMS.find((n) => n.href === '/circulation')!, inactiveProfile)).toBe(false);
    });
  });

  describe('ROLE 4: Student / Patron (Clearance Level 1 / End User)', () => {
    const role: Role = 'student';
    const activeStudentProfile: Profile = {
      full_name: 'John Student',
      status: 'ACTIVE',
      role: 'student',
      permissions: null,
    };

    it('identifies Student as non-staff with rank 1', () => {
      expect(ROLE_RANKS[role]).toBe(1);
      expect(isStaff(role, activeStudentProfile)).toBe(false);
      expect(isAccessBlocked(activeStudentProfile)).toBe(false);
    });

    it('has access only to patron modules', () => {
      const studentAllowed = ['/dashboard', '/student-catalog', '/history', '/attendance'];
      for (const path of studentAllowed) {
        const item = ALL_NAV_ITEMS.find((n) => n.href === path)!;
        expect(hasPermission(role, item, activeStudentProfile)).toBe(true);
      }
    });

    it('is strictly blocked from all Staff and Administrative tools', () => {
      const staffBlocked = ['/inventory', '/circulation', '/analytics', '/users', '/policies', '/audit'];
      for (const path of staffBlocked) {
        const item = ALL_NAV_ITEMS.find((n) => n.href === path)!;
        expect(hasPermission(role, item, activeStudentProfile)).toBe(false);
      }
    });

    it('blocks access when student status is PENDING (onboarding incomplete)', () => {
      const pendingProfile: Profile = {
        full_name: 'New Student',
        status: 'PENDING',
        role: 'student',
      };
      expect(isAccessBlocked(pendingProfile)).toBe(true);
    });

    it('blocks access when student status is SUSPENDED or INACTIVE', () => {
      const suspendedProfile: Profile = {
        full_name: 'Suspended Student',
        status: 'SUSPENDED',
        role: 'student',
      };
      const inactiveProfile: Profile = {
        full_name: 'Inactive Student',
        status: 'INACTIVE',
        role: 'student',
      };
      expect(isAccessBlocked(suspendedProfile)).toBe(true);
      expect(isAccessBlocked(inactiveProfile)).toBe(true);
    });
  });
});
