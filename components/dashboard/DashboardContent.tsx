import { getDashboardStats } from "@/lib/actions/dashboard";
import { getMyReservations } from "@/lib/actions/reservations";
import { getBooks, getCategories } from '@/lib/actions/catalog';
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getMe } from "@/lib/auth-helpers";
import { Reservation, ProfileData } from "@/lib/types";

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

  // Optional: Library card for students and SAs
  const isStudent = role === "student";
  
  const cardPromise = supabase
        .from("library_cards")
        .select("card_number, status, expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

  // Optional: FAQ items for students and SAs
  const faqPromise = (isStudent || role === "student_assistant")
    ? supabase
        .from("system_settings")
        .select("key, value")
        .in("key", faqKeys)
    : Promise.resolve({ data: null, error: null });

  // Optional: Fetch current reservations for anyone who might need to see them (students/SAs)
  const reservationsPromise = (isStudent || role === "student_assistant")
    ? (getMyReservations() as unknown as Promise<Reservation[]>)
    : Promise.resolve([]);

  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const q = params.q || '';
  const categoryId = params.categoryId || '';
  const sort = params.sort || 'newest';
  const view = params.view || 'grid';
  const pageSize = view === 'list' ? 10 : 9;

  const isStaffActive = profile?.status?.toUpperCase() === 'ACTIVE';
  const canSeeStaffInventory = role === 'admin' || 
                               role === 'librarian' || 
                               (role === 'student_assistant' && isStaffActive && profile?.permissions?.manage_inventory);

  const inventoryCategoriesPromise = canSeeStaffInventory
    ? getCategories() 
    : Promise.resolve([]);
    
  const inventoryBooksPromise = canSeeStaffInventory
    ? getBooks(q, categoryId || undefined, page, pageSize, sort)
    : Promise.resolve({ data: [], count: 0 });

  const attendanceQuery = supabase
    .from("attendance")
    .select("*, profiles(full_name)")
    .order("check_in_at", { ascending: false })
    .limit(5);

  const canSeeAllAttendance = role === 'admin' || 
                               role === 'librarian' || 
                               (role === 'student_assistant' && isStaffActive);

  const attendancePromise = canSeeAllAttendance
    ? attendanceQuery
    : attendanceQuery.eq("user_id", user.id);

  // Fetch UI preferences for SA mode toggle
  const { data: preferencesData } = await supabase
    .from("ui_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  const preferences = (preferencesData?.preferences as Record<string, string>) || {};
  let preferredView = preferences.preferred_dashboard_view;
  if (role === "student_assistant" && !isStaffActive) {

    preferredView = "student";
  }

  // Pass promises to the client component for rendering with Suspense/use() where needed
  return (
    <DashboardClient 
      user={user} 
      role={role} 
      preferredView={preferredView}
      statsPromise={statsPromise}
      profilePromise={Promise.resolve({ data: profile as unknown as ProfileData | null, error: null })}
      cardPromise={cardPromise as unknown as Promise<{ data: { card_number: string; status: string; expires_at: string } | null }>}
      faqPromise={faqPromise as unknown as Promise<{ data: { key: string; value: string | null }[] | null }>}
      reservationsPromise={reservationsPromise}
      inventoryBooksPromise={inventoryBooksPromise}
      inventoryCategoriesPromise={inventoryCategoriesPromise}
      attendancePromise={attendancePromise as unknown as Promise<{ data: { id: string; check_in_at: string; user_id: string; profiles?: { full_name: string | null } }[] | null; error: Error | null }>}
    />
  );
}
