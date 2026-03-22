import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { DashboardClient } from "@/components/dashboard-client";
import { getDeterministicQrUrl, resolveStudentId } from "@/lib/library-card-assets";
import { DEFAULT_STUDENT_FAQS } from "@/lib/actions/policy-constants";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard | Lumina LMS",
};

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
  } | null = null;
  let studentFaqs: { question: string; answer: string }[] = [...DEFAULT_STUDENT_FAQS];

  if (role === "student") {
    const { data: profileData } = await supabase
      .from("profiles")
      .select(`
        full_name,
        student_id,
        department,
        avatar_url,
        library_cards (
          card_number,
          status,
          expires_at
        )
      `)
      .eq("id", user.id)
      .single();

    if (profileData) {
      const card = profileData.library_cards?.[0];
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
    <DashboardClient 
      user={user} 
      role={role} 
      stats={stats} 
      studentCard={studentCard}
      studentFaqs={studentFaqs}
    />
  );
}
