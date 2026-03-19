'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function assertStaffCatalogAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !profile || !['admin', 'librarian', 'staff'].includes(String(profile.role))) {
    throw new Error('Forbidden');
  }

  return supabase;
}

// --- Categories ---

export async function getCategories() {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function createCategory(name: string, description?: string) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('categories')
    .insert([{ name, description }])
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  return data;
}

// --- Books ---

export async function getBooks(query: string = '', categoryId?: string) {
  const supabase = await assertStaffCatalogAccess();
  let dbQuery = supabase.from('books').select(`*, categories(name)`).eq('is_active', true);
  
  if (query) {
    dbQuery = dbQuery.textSearch('search_vector', query.split(' ').join(' | '));
  }
  
  if (categoryId) {
    dbQuery = dbQuery.eq('category_id', categoryId);
  }
  
  const { data, error } = await dbQuery.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getBookById(id: string) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('books')
    .select(`*, categories(name)`)
    .eq('id', id)
    .single();
    
  if (error) throw new Error(error.message);
  return data;
}

export async function createBook(bookData: Record<string, unknown>, copiesCount: number = 1) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('books')
    .insert([bookData])
    .select()
    .single();
    
  if (error) throw new Error(error.message);

  // Automatically create copies
  if (copiesCount > 0) {
    const copies = Array.from({ length: copiesCount }).map(() => ({
      book_id: data.id,
      status: 'AVAILABLE'
    }));

    const { error: copiesError } = await supabase
      .from('book_copies')
      .insert(copies);

    if (copiesError) {
      console.error('Error creating book copies:', copiesError);
      // We don't throw here to avoid failing the whole process if copies fail but book succeeded
      // though throwing might be better for visibility. Let's throw for now.
      throw new Error(`Book created but copies failed: ${copiesError.message}`);
    }
  }

  revalidatePath('/protected/catalog');
  return data;
}

export async function updateBook(id: string, bookData: Record<string, unknown>) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('books')
    .update(bookData)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  revalidatePath('/protected/catalog');
  revalidatePath(`/protected/catalog/${id}`);
  return data;
}

export async function softDeleteBook(id: string) {
  const supabase = await assertStaffCatalogAccess();
  
  // Check for active borrowed copies
  const { count, error: countError } = await supabase
    .from('book_copies')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', id)
    .eq('status', 'BORROWED');
    
  if (countError) throw new Error(countError.message);
  
  if (count && count > 0) {
    throw new Error('Cannot delete book: There are active borrowed copies.');
  }

  const { data, error } = await supabase
    .from('books')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  revalidatePath('/protected/catalog');
  return data;
}

// --- Book Copies ---

export async function getBookCopies(bookId: string) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('book_copies')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function createBookCopy(bookId: string, condition?: string) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('book_copies')
    .insert([{ book_id: bookId, condition }])
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  revalidatePath('/protected/catalog');
  revalidatePath(`/protected/catalog/${bookId}`);
  return data;
}

export async function updateBookCopyStatus(id: string, status: 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST') {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('book_copies')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  revalidatePath('/protected/catalog');
  revalidatePath(`/protected/catalog/${data.book_id}`);
  return data;
}
