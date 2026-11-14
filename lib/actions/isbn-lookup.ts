"use server";
import { assertStaffCatalogAccess } from './catalog/auth';
import { lookupISBN } from '@/lib/isbn-lookup';
export async function fetchISBNDetails(isbn: string) {
  await assertStaffCatalogAccess();
  return lookupISBN(isbn);
}
