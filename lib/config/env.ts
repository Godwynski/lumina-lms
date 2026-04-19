import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPLOAD_PATH: z.string().default("./uploads/resources"),
  NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH: z
    .string()
    .transform((val) => val === "true")
    .default(false),
});

const result = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  UPLOAD_PATH: process.env.UPLOAD_PATH,
  NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH: process.env.NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH,
});

if (!result.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(result.error.format(), null, 2)
  );
  throw new Error("Invalid environment variables");
}

export const env = result.data;
