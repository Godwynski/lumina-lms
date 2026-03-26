import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getDeterministicQrUrl, resolveStudentId } from "@/lib/library-card-assets";
import { DEFAULT_STUDENT_FAQS } from "@/lib/actions/policy-constants";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard | Lumina LMS",
};

export const dynamic = "force-dynamic";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  const role = await getUserRole();
  const stats = await getDashboardStats({
    userId: user.id,
    role,
  });

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

  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, student_id, department, avatar_url, address, phone")
    .eq("id", user.id)
    .single();

  if (role === "student") {
    const { data: card } = await supabase
      .from("library_cards")
      .select("card_number, status, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

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

    const faqKeys = [
      "faq_student_q1",
      "faq_student_a1",
      "faq_student_q2",
      "faq_student_a2",
      "faq_student_q3",
      "faq_student_a3",
      "faq_student_q4",
      "faq_student_a4",
    ];

    const { data: faqRows } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", faqKeys);

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
        <div className="relative w-full max-w-sm sm:w-auto">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="search"
            placeholder="Search books, ISBN, or authors..."
            className="h-10 w-full rounded-full border border-border bg-muted/30 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64 md:w-80"
          />
        </div>
      </header>

      <DashboardClient 
        user={user} 
        role={role} 
        stats={stats} 
        studentCard={studentCard}
        studentFaqs={studentFaqs}
      />
    </div>
  );
}
