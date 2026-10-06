import { describe, it, expect } from 'vitest';
import {
  UserCreateSchema,
  UserPatchSchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  BulkNotificationSchema,
  ProfilePatchSchema,
  ReservationCreateSchema,
} from '../api';

describe('API Validation Schemas', () => {
  describe('UserCreateSchema', () => {
    it('validates a valid user creation payload', () => {
      const result = UserCreateSchema.safeParse({
        email: 'alice@example.com',
        role: 'student',
        department: 'Computer Science',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email formats', () => {
      const result = UserCreateSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing email', () => {
      const result = UserCreateSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('UserPatchSchema', () => {
    it('requires an id', () => {
      const missingId = UserPatchSchema.safeParse({ name: 'Bob' });
      expect(missingId.success).toBe(false);

      const valid = UserPatchSchema.safeParse({ id: 'user-123', name: 'Bob' });
      expect(valid.success).toBe(true);
    });

    it('accepts optional fields correctly', () => {
      const valid = UserPatchSchema.safeParse({
        id: 'user-123',
        department: 'Engineering',
        role: 'staff',
        status: 'active',
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('CategoryCreateSchema & CategoryUpdateSchema', () => {
    it('validates valid category creation', () => {
      const result = CategoryCreateSchema.safeParse({
        name: 'Science Fiction',
        slug: 'sci-fi',
        description: 'Sci-fi books and media',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty category name', () => {
      const result = CategoryCreateSchema.safeParse({ name: '   ' });
      expect(result.success).toBe(false);
    });

    it('validates category update with optional fields', () => {
      const result = CategoryUpdateSchema.safeParse({
        name: 'Updated Sci-Fi',
        is_active: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('BulkNotificationSchema', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('validates a well-formed bulk notification payload', () => {
      const result = BulkNotificationSchema.safeParse({
        userIds: [validUuid],
        title: 'Library Announcement',
        content: 'System will undergo maintenance.',
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty userIds array', () => {
      const result = BulkNotificationSchema.safeParse({
        userIds: [],
        title: 'Announcement',
        content: 'Notice',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUID in userIds', () => {
      const result = BulkNotificationSchema.safeParse({
        userIds: ['non-uuid'],
        title: 'Announcement',
        content: 'Notice',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ProfilePatchSchema', () => {
    it('validates valid profile update with defaults', () => {
      const result = ProfilePatchSchema.safeParse({
        displayName: 'John Doe',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.address).toBe('');
        expect(result.data.phone).toBe('');
        expect(result.data.department).toBe('');
      }
    });

    it('rejects empty displayName', () => {
      const result = ProfilePatchSchema.safeParse({
        displayName: '   ',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ReservationCreateSchema', () => {
    const validBookId = '123e4567-e89b-12d3-a456-426614174000';
    const validUserId = '987fcdeb-51a2-43f7-9876-543210987654';

    it('validates reservation with valid UUIDs', () => {
      const result = ReservationCreateSchema.safeParse({
        bookId: validBookId,
        userId: validUserId,
      });
      expect(result.success).toBe(true);
    });

    it('validates reservation without optional userId', () => {
      const result = ReservationCreateSchema.safeParse({
        bookId: validBookId,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing or non-UUID bookId', () => {
      const missing = ReservationCreateSchema.safeParse({});
      expect(missing.success).toBe(false);

      const invalid = ReservationCreateSchema.safeParse({ bookId: 'not-a-uuid' });
      expect(invalid.success).toBe(false);
    });

    it('rejects invalid userId when provided', () => {
      const result = ReservationCreateSchema.safeParse({
        bookId: validBookId,
        userId: 'invalid-uuid',
      });
      expect(result.success).toBe(false);
    });
  });
});
