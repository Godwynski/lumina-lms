import { getDashboardStats } from "@/lib/actions/dashboard";
import { getMyReservations } from "@/lib/actions/reservations";
import { getBooks, getCategories } from '@/lib/actions/catalog';
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getMe } from "@/lib/auth-helpers";
import { Reservation } from "@/lib/types";

/**
 * Server Component that orchestrates various data promises for the dashboard.
 * It uses the 'getMe' helper which is cached per-request.
 */
export async function DashboardContent({ 
  searchParams 
}: { 
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string; sort?: string; view?: string }> 
}) {
  const me = await getMe();
  if (!me) return null;
  
  const { user, role, profile, supabase } = me;

  const faqKeys = ["student_faq_list"];

  // Kick off stats data promise for the appropriate role
  const statsPromise = getDashboardStats({ role });

  // Optional: Library card for students
  const cardPromise = role === "student"
    ? supabase
        .from("library_cards")
        .select("card_number, status, expires_at")
        .eq("user_id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  // Optional: FAQ items for students
  const faqPromise = role === "student"
    ? supabase
        .from("system_settings")
        .select("key, value")
        .in("key", faqKeys)
    : Promise.resolve({ data: null, error: null });

  // Optional: Fetch current reservations for students
  const reservationsPromise = role === "student"
    ? (getMyReservations() as unknown as Promise<Reservation[]>)
    : Promise.resolve([]);

  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const q = params.q || '';
  const categoryId = params.categoryId || '';
  const sort = params.sort || 'title_asc';
  const view = params.view || 'grid';
  const pageSize = view === 'list' ? 10 : 9;

  const inventoryCategoriesPromise = role !== "student" 
    ? getCategories() 
    : Promise.resolve([]);
    
  const inventoryBooksPromise = role !== "student"
    ? getBooks(q, categoryId || undefined, page, pageSize, sort)
    : Promise.resolve({ data: [], count: 0 });

  // Pass promises to the client component for rendering with Suspense/use() where needed
  return (
    <DashboardClient 
      user={user} 
      role={role} 
      statsPromise={statsPromise}
      profilePromise={Promise.resolve({ data: profile, error: null })}
      cardPromise={cardPromise as unknown as Promise<{ data: { card_number: string; status: string; expires_at: string } | null }>}
      faqPromise={faqPromise as unknown as Promise<{ data: { key: string; value: string | null }[] | null }>}
      reservationsPromise={reservationsPromise}
      inventoryBooksPromise={inventoryBooksPromise}
      inventoryCategoriesPromise={inventoryCategoriesPromise}
    />
  );
}
