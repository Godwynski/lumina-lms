import { redirect } from 'next/navigation';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string; status?: string }>;
}) {
  const params = await searchParams;
  const queryString = new URLSearchParams(params as Record<string, string>).toString();
  redirect(`/inventory${queryString ? `?${queryString}` : ''}`);
}
