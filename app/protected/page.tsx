import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";

import { getDeterministicQrUrl, resolveStudentId } from "@/lib/library-card-assets";
import { DEFAULT_STUDENT_FAQS } from "@/lib/actions/policy-constants";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

export const metadata = {
  title: "Dashboard | Lumina LMS",
};


export default async function ProtectedPage() {
  noStore();
  const supabase = await createClient();

  // 1. Get user and role concurrently
  const [userResult, role] = await Promise.all([
    supabase.auth.getUser(),
    getUserRole()
  ]);

  const user = userResult.data?.user;

  if (!user) {
    return redirect("/auth/login");
  }

  // Cast to User to satisfy DashboardClient's expectation
  const dashboardUser = user as unknown as import("@supabase/supabase-js").User;

  const faqKeys = [
    "faq_student_q1", "faq_student_a1",
    "faq_student_q2", "faq_student_a2",
    "faq_student_q3", "faq_student_a3",
    "faq_student_q4", "faq_student_a4",
  ];

  // 2. Fetch all dashboard data points in parallel
  // This reduces the theoretical wait time from sum(queries) to max(queries)
  const [stats, profileResult, cardResult, faqResult] = await Promise.all([
    getDashboardStats({ role }),
    supabase
      .from("profiles")
      .select("full_name, student_id, department, avatar_url, address, phone")
      .eq("id", user.id)
      .single(),
    role === "student"
      ? supabase
          .from("library_cards")
          .select("card_number, status, expires_at")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    role === "student"
      ? supabase
          .from("system_settings")
          .select("key, value")
          .in("key", faqKeys)
      : Promise.resolve({ data: null }),
  ]);

  const profileData = profileResult.data;

  let studentCard: {
    fullName: string;
    studentId: string;
    cardNumber: string;
    department: string;
    status: "active" | "pending" | "suspended" | "expired";
    expiryDate: string;
    avatarUrl: string | null;
    qrUrl: string | null;
    address?: string;
    phone?: string;
  } | null = null;
  let studentFaqs: { question: string; answer: string }[] = [...DEFAULT_STUDENT_FAQS];

  if (role === "student") {
    const card = cardResult.data;
    const faqRows = faqResult.data;

    if (profileData) {
      const resolvedStudentId = resolveStudentId({
        studentId: profileData.student_id,
        fallbackEmail: user.email,
        userId: user.id,
      });

      studentCard = {
        fullName: profileData.full_name || "Student",
        studentId: resolvedStudentId || profileData.student_id || "N/A",
        cardNumber: card?.card_number || "Pending assignment",
        department: profileData.department || "General",
        status: (card?.status as "active" | "pending" | "suspended" | "expired") || "pending",
        expiryDate: card?.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
        avatarUrl: profileData.avatar_url,
        qrUrl: resolvedStudentId ? getDeterministicQrUrl(resolvedStudentId) : null,
        address: profileData.address,
        phone: profileData.phone,
      };
    }

    if (faqRows && faqRows.length > 0) {
      const byKey = new Map(faqRows.map((row) => [String(row.key), String(row.value ?? "")]));
      const pairs: { question: string; answer: string }[] = [];

      for (let i = 1; i <= 4; i += 1) {
        const question = byKey.get(`faq_student_q${i}`) || DEFAULT_STUDENT_FAQS[i - 1]?.question || "";
        const answer = byKey.get(`faq_student_a${i}`) || DEFAULT_STUDENT_FAQS[i - 1]?.answer || "";
        if (question.trim() && answer.trim()) {
          pairs.push({ question, answer });
        }
      }

      if (pairs.length > 0) {
        studentFaqs = pairs;
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {role === 'student' ? 'Student Dashboard' : 'Operations Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {role === 'student' 
              ? `Welcome back, ${profileData?.full_name?.split(' ')[0] || 'Student'}. Here's your library at a glance.`
              : 'Core actions, queue visibility, and recent activity.'}
          </p>
        </div>
        <DashboardSearch role={role} />

      </header>

      <DashboardClient 
        user={dashboardUser} 
        role={role} 
        stats={stats} 
        studentCard={studentCard}
        studentFaqs={studentFaqs}
      />
    </div>
  );
}
