'use server';

import { SupabaseClient } from '@supabase/supabase-js';
import { createSafeClient } from '@/lib/supabase/server';
import { toSlug } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { unstable_cache, revalidateTag } from 'next/cache';

/**
 * Fetches all inventory categories. Results are cached via Next.js unstable_cache.
 * @returns Array of categories.
 */
export const getCategories = async () => {
  return unstable_cache(
    async () => {
      const supabase = createSafeClient();
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, description, is_active, created_at')
        .order('name');
      if (error) throw new Error(error.message);
      return data;
    },
    ['catalog-categories'],
    { revalidate: 3600, tags: ['categories'] }
  )();
};

/**
 * Resolves an existing category by name (case-insensitive) or dynamically creates one.
 * Used during automated catalog imports and ISBN lookups.
 */
export async function getOrCreateCategoryByName(supabase: SupabaseClient, name: string) {
  const cleanName = name.trim();
  if (!cleanName) return null;

  // 1. Try to find existing category (case insensitive)
  const { data: existing, error } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', cleanName)
    .maybeSingle();

  if (error) {
    logger.error('catalog', `Error finding category: ${cleanName}`, { error: error.message });
  }

  if (existing) {
    return existing.id;
  }

  // 2. If it doesn't exist, create it
  const slug = toSlug(cleanName);

  const { data: created, error: createError } = await supabase
    .from('categories')
    .insert([{
      name: cleanName,
      slug,
      is_active: true,
      description: `Category created during batch import of books.`
    }])
    .select('id')
    .single();

  if (createError) {
    logger.error('catalog', `Error creating category: ${cleanName}`, { error: createError.message });
    throw new Error(`Failed to create category "${cleanName}": ${createError.message}`);
  }

  // Revalidate categories cache
  revalidateTag('categories', 'max');

  return created.id;
}
