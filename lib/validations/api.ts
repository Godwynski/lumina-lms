import { z } from "zod";

export const PatronTypeSchema = z.enum(["student", "faculty"]);

export const UserCreateSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  role: z.string().optional(),
  patron_type: PatronTypeSchema.optional().default("student"),
  department: z.string().trim().optional(),
});

export const UserPatchSchema = z.object({
  id: z.string().trim().min(1, "User ID is required"),
  name: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  role: z.string().optional(),
  patron_type: PatronTypeSchema.optional(),
  status: z.string().optional(),
  department: z.string().trim().nullable().optional(),
  student_id: z.string().trim().nullable().optional(),
  permissions: z.record(z.string(), z.boolean()).or(z.array(z.string())).optional(),
  address: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
});

export const OnboardingSchema = z
  .object({
    address: z.string().trim().min(1, "Address is required"),
    phone: z.string().trim().min(1, "Contact number is required"),
    patron_type: PatronTypeSchema.optional().default("student"),
    department: z.string().trim().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.patron_type === "student" && !val.department?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["department"],
        message: "Academic program is required for students",
      });
    }
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
  userIds: z.array(z.string().uuid("Invalid user ID")).optional(),
  target: z.enum(["all", "students"]).optional(),
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
}).refine(data => (data.userIds && data.userIds.length > 0) || Boolean(data.target), {
  message: "Either userIds or target must be provided",
  path: ["userIds"],
});

export const ReservationCreateSchema = z.object({
  bookId: z
    .string()
    .min(1, "bookId is required")
    .uuid("bookId must be a valid UUID"),
  userId: z.string().uuid("userId must be a valid UUID").optional(),
});
