import { describe, it, expect } from 'vitest';
import { mapProfileToUser } from '../mappers';
import { bustAvatarCache } from '../avatar-cache';
import type { User } from '@/lib/types';

describe('Profile Mappers & Avatar Cache Utilities', () => {
  describe('mapProfileToUser', () => {
    it('maps complete profile record to canonical User interface', () => {
      const rawRow = {
        id: 'usr-100',
        full_name: 'Maria Clara',
        email: 'maria.clara@school.edu',
        avatar_url: 'https://storage.example.com/avatar.png',
        role: 'super_admin',
        status: 'active',
        department: 'Library Services',
        created_at: '2025-05-15T08:30:00.000Z',
        student_id: 'FAC-2025-01',
        address: '456 Academic Blvd',
        phone: '09991234567',
        updated_at: '2026-01-10T12:00:00.000Z',
        onboarding_completed: true,
        library_cards: [
          {
            card_number: 'LC-999',
            status: 'ACTIVE',
            expires_at: '2027-01-01',
          },
        ],
        permissions: { manage_circulation: true },
      };

      const user: User = mapProfileToUser(rawRow);

      expect(user).toEqual({
        id: 'usr-100',
        name: 'Maria Clara',
        email: 'maria.clara@school.edu',
        avatarUrl: 'https://storage.example.com/avatar.png',
        role: 'super_admin',
        status: 'ACTIVE',
        department: 'Library Services',
        joined: new Date('2025-05-15T08:30:00.000Z').toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        }),
        student_id: 'FAC-2025-01',
        address: '456 Academic Blvd',
        phone: '09991234567',
        updatedAt: '2026-01-10T12:00:00.000Z',
        onboarding_completed: true,
        library_card: {
          card_number: 'LC-999',
          status: 'ACTIVE',
          expires_at: '2027-01-01',
        },
        permissions: { manage_circulation: true },
      });
    });

    describe('Name derivation and fallbacks', () => {
      it('derives human-readable name from email when full_name is null', () => {
        const user = mapProfileToUser({
          id: 'u-1',
          full_name: null,
          email: 'john.smith@domain.com',
        });
        expect(user.name).toBe('John Smith');
      });

      it('derives human-readable name from single-part email localpart', () => {
        const user = mapProfileToUser({
          id: 'u-2',
          full_name: '   ',
          email: 'alexander@domain.com',
        });
        expect(user.name).toBe('Alexander');
      });

      it('derives multi-part email name properly', () => {
        const user = mapProfileToUser({
          id: 'u-3',
          full_name: undefined,
          email: 'juan.carlos.delacruz@school.edu',
        });
        expect(user.name).toBe('Juan Carlos Delacruz');
      });

      it('falls back to "Unnamed User" when both full_name and email are missing', () => {
        const user = mapProfileToUser({
          id: 'u-4',
          full_name: null,
          email: null,
        });
        expect(user.name).toBe('Unnamed User');
      });
    });

    describe('Role & status normalization', () => {
      it('preserves valid roles: super_admin, librarian, student_assistant, student', () => {
        const roles = ['super_admin', 'librarian', 'student_assistant', 'student'] as const;
        for (const role of roles) {
          const user = mapProfileToUser({ id: 'u', role });
          expect(user.role).toBe(role);
        }
      });

      it('defaults to "student" for unknown, empty, or unexpected roles', () => {
        expect(mapProfileToUser({ id: 'u', role: 'anonymous' }).role).toBe('student');
        expect(mapProfileToUser({ id: 'u', role: null }).role).toBe('student');
        expect(mapProfileToUser({ id: 'u', role: '' }).role).toBe('student');
      });

      it('normalizes status string to uppercase with ACTIVE fallback', () => {
        expect(mapProfileToUser({ id: 'u', status: 'pending' }).status).toBe('PENDING');
        expect(mapProfileToUser({ id: 'u', status: 'inactive' }).status).toBe('INACTIVE');
        expect(mapProfileToUser({ id: 'u', status: null }).status).toBe('ACTIVE');
      });
    });

    describe('Department & relations mapping', () => {
      it('defaults department to "General" when missing or blank', () => {
        expect(mapProfileToUser({ id: 'u', department: null }).department).toBe('General');
        expect(mapProfileToUser({ id: 'u', department: '   ' }).department).toBe('General');
        expect(mapProfileToUser({ id: 'u', department: 'Engineering' }).department).toBe('Engineering');
      });

      it('handles library card when passed as an object instead of array', () => {
        const cardObj = { card_number: 'CARD-SINGLE', status: 'ACTIVE' };
        const user = mapProfileToUser({ id: 'u', library_cards: cardObj });
        expect(user.library_card).toEqual(cardObj);
      });

      it('handles null library cards and empty permissions safely', () => {
        const user = mapProfileToUser({
          id: 'u',
          library_cards: null,
          permissions: null,
        });
        expect(user.library_card).toBeNull();
        expect(user.permissions).toEqual({});
      });

      it('formats valid created_at date into "MMM YYYY" format and "Unknown" if missing', () => {
        const user = mapProfileToUser({ id: 'u', created_at: null });
        expect(user.joined).toBe('Unknown');
      });
    });
  });

  describe('bustAvatarCache', () => {
    it('returns undefined if url is empty, null, or undefined', () => {
      expect(bustAvatarCache(undefined, '2026-10-01T00:00:00Z')).toBeUndefined();
      expect(bustAvatarCache(null, '2026-10-01T00:00:00Z')).toBeUndefined();
      expect(bustAvatarCache('', '2026-10-01T00:00:00Z')).toBeUndefined();
    });

    it('returns unmodified url if updatedAt is missing or null', () => {
      const url = 'https://example.com/avatar.png';
      expect(bustAvatarCache(url, undefined)).toBe(url);
      expect(bustAvatarCache(url, null)).toBe(url);
      expect(bustAvatarCache(url, '')).toBe(url);
    });

    it('appends ?v=<timestamp> when url has no query parameters', () => {
      const url = 'https://example.com/profile_STU-001.webp';
      const dateStr = '2026-10-06T12:00:00.000Z';
      const expectedTs = new Date(dateStr).getTime();

      const result = bustAvatarCache(url, dateStr);
      expect(result).toBe(`${url}?v=${expectedTs}`);
    });

    it('appends &v=<timestamp> when url already contains query parameters', () => {
      const url = 'https://example.com/avatar.png?width=200&format=webp';
      const dateStr = '2026-10-06T14:30:00.000Z';
      const expectedTs = new Date(dateStr).getTime();

      const result = bustAvatarCache(url, dateStr);
      expect(result).toBe(`${url}&v=${expectedTs}`);
    });

    it('returns unmodified url when updatedAt is an invalid date string', () => {
      const url = 'https://example.com/avatar.png';
      expect(bustAvatarCache(url, 'not-a-valid-date')).toBe(url);
    });
  });
});
