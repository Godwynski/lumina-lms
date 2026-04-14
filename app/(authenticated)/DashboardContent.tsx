import { getDashboardStats } from "@/lib/actions/dashboard";
import { getMyReservations } from "@/lib/actions/reservations";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

interface DashboardContentProps {
  user: User;
  role: string | null;
}

export async function DashboardContent({ user, role }: DashboardContentProps) {
  const supabase = await createClient();

  const faqKeys = [
    "faq_student_q1", "faq_student_a1",
    "faq_student_q2", "faq_student_a2",
    "faq_student_q3", "faq_student_a3",
    "faq_student_q4", "faq_student_a4",
  ];

  // 1. Kick off all promises concurrently
  const statsPromise = getDashboardStats({ role });
  const profilePromise = supabase
    .from("profiles")
    .select("full_name, student_id, department, avatar_url, address, phone")
    .eq("id", user.id)
    .single();

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (getMyReservations() as unknown as Promise<any[]>)
    : Promise.resolve([]);

  // 2. We pass the promises to the client component
  // The client will use the 'use()' hook to unwrap them
  return (
    <DashboardClient 
      user={user} 
      role={role} 
      statsPromise={statsPromise}
      profilePromise={Promise.resolve(profilePromise)}
      cardPromise={Promise.resolve(cardPromise)}
      faqPromise={Promise.resolve(faqPromise)}
      reservationsPromise={reservationsPromise}
    />
  );
}
