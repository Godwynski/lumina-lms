import { z } from "zod";

export const UserCreateSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  role: z.string().optional(),
  department: z.string().trim().optional(),
});

export const UserPatchSchema = z.object({
  id: z.string().trim().min(1, "User ID is required"),
  name: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  department: z.string().trim().optional(),
  student_id: z.string().trim().optional(),
  permissions: z.record(z.string(), z.boolean()).or(z.array(z.string())).optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

export const CategoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const CategoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const BulkNotificationSchema = z.object({
  userIds: z.array(z.string().uuid("Invalid user ID")).min(1, "At least one user ID is required"),
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required"),
  type: z
    .enum([
      "SYSTEM",
      "CIRCULATION",
      "RESERVATION",
      "OVERDUE",
      "ACCOUNT",
      "DUE_SOON",
      "RESERVATION_EXPIRED",
    ])
    .optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ProfilePatchSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(150),
  address: z.string().trim().max(255).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  department: z.string().trim().max(100).optional().default(""),
});

export const ReservationCreateSchema = z.object({
  bookId: z
    .string()
    .min(1, "bookId is required")
    .uuid("bookId must be a valid UUID"),
  userId: z.string().uuid("userId must be a valid UUID").optional(),
});
