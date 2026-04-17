import { getDashboardStats } from "@/lib/actions/dashboard";
import { getMyReservations } from "@/lib/actions/reservations";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getMe } from "@/lib/auth-helpers";
import { Reservation } from "@/lib/types";


export async function DashboardContent() {
  const me = await getMe();
  if (!me) return null;
  
  const { user, role, profile, supabase } = me;

  const faqKeys = [
    "faq_student_q1", "faq_student_a1",
    "faq_student_q2", "faq_student_a2",
    "faq_student_q3", "faq_student_a3",
    "faq_student_q4", "faq_student_a4",
  ];

  // 1. Kick off relevant promises concurrently
  const statsPromise = getDashboardStats({ role });

  const cardPromise = role === "student"
    ? supabase
        .from("library_cards")
        .select("card_number, status, expires_at")
        .eq("user_id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const faqPromise = role === "student"
    ? supabase
        .from("system_settings")
        .select("key, value")
        .in("key", faqKeys)
    : Promise.resolve({ data: null });

  const reservationsPromise = role === "student"
    ? (getMyReservations() as unknown as Promise<Reservation[]>)
    : Promise.resolve([]);

  // 2. We pass the promises/data to the client component
  return (
    <DashboardClient 
      user={user} 
      role={role} 
      statsPromise={statsPromise}
      profilePromise={Promise.resolve({ data: profile, error: null })}
      cardPromise={Promise.resolve(cardPromise)}
      faqPromise={Promise.resolve(faqPromise)}
      reservationsPromise={reservationsPromise}
    />
  );
}
