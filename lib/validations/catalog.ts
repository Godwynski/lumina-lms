import { z } from "zod";

export const BookSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  author: z.string().min(1, "Author is required").max(255),
  isbn: z.string().optional().nullable(),
  category_id: z.string().uuid("Invalid category ID"),
  description: z.string().optional().nullable(),
  published_year: z.number().int().min(1000).max(new Date().getFullYear() + 1).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const CategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional().nullable(),
});

export type BookInput = z.infer<typeof BookSchema>;
export type CategoryInput = z.infer<typeof CategorySchema>;
