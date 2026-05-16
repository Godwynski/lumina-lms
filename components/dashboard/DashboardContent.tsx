import { getDashboardStats } from "@/lib/actions/dashboard";
import { getMyReservations } from "@/lib/actions/reservations";
import { getBooks, getCategories } from '@/lib/actions/catalog';
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getMe } from "@/lib/auth-helpers";
import { Reservation, ProfileData } from "@/lib/types";

export async function DashboardContent({ 
  searchParams 
}: { 
  searchParams: Promise<{ 
    page?: string; 
    q?: string; 
    stock?: string; 
    categoryId?: string; 
    sort?: string; 
    view?: string;
    status?: string;
  }> 
}) {
  const me = await getMe();
  if (!me) return null;
  
  const { user, role, profile, supabase } = me;

  const faqKeys = ["student_faq_list"];

  const isStudent = role === "student";
  const isStaffActive = profile?.status?.toUpperCase() === 'ACTIVE';
  const canSeeStaffInventory = role === 'admin' || role === 'librarian';

  // Fire ALL non-blocking promises at once — no sequential awaits
  const statsPromise = getDashboardStats({ role });
  
  const cardPromise = supabase
        .from("library_cards")
        .select("card_number, status, expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

  const faqPromise = (isStudent || role === "student_assistant")
    ? supabase
        .from("system_settings")
        .select("key, value")
        .in("key", faqKeys)
    : Promise.resolve({ data: null, error: null });

  const reservationsPromise = (isStudent || role === "student_assistant")
    ? (getMyReservations() as unknown as Promise<Reservation[]>)
    : Promise.resolve([]);

  const prefsPromise = supabase
    .from("ui_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  const attendancePromise = supabase
    .from("attendance")
    .select("id, check_in_at, check_out_at")
    .eq("user_id", user.id)
    .order("check_in_at", { ascending: false })
    .limit(5);

  // Await only what we need for rendering decisions
  const [params, { data: preferencesData }, { data: attendanceLogs }] = await Promise.all([
    searchParams,
    prefsPromise,
    attendancePromise
  ]);

  const activeAttendance = attendanceLogs?.find(a => !a.check_out_at) || null;



  const page = parseInt(params.page || '1', 10);
  const q = params.q || '';
  const categoryId = params.categoryId || '';
  const sort = params.sort || 'newest';
  const view = params.view || 'grid';
  const status = (params.status?.toUpperCase() as 'ACTIVE' | 'ARCHIVED' | 'ALL') || 'ACTIVE';
  const pageSize = view === 'list' ? 10 : 9;

  const inventoryCategoriesPromise = canSeeStaffInventory
    ? getCategories() 
    : Promise.resolve([]);
    
  const inventoryBooksPromise = canSeeStaffInventory
    ? getBooks(q, categoryId || undefined, page, pageSize, sort, status)
    : Promise.resolve({ data: [], count: 0 });

  const preferences = (preferencesData?.preferences as Record<string, string>) || {};
  let preferredView = preferences.preferred_dashboard_view;
  if (role === "admin" || role === "librarian") {
    preferredView = "staff";
  } else if (role === "student_assistant" && (!isStaffActive || !profile?.permissions?.view_admin_dashboard)) {
    preferredView = "student";
  }

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
      activeAttendance={activeAttendance}
      attendanceLogs={attendanceLogs || []}
    />


  );
}
