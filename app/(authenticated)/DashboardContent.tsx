import { getDashboardStats } from "@/lib/actions/dashboard";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentId, getDeterministicQrUrl } from "@/lib/library-card-assets";
import { DEFAULT_STUDENT_FAQS } from "@/lib/actions/policy-constants";
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

  let studentCard = null;
  let studentFaqs = [...DEFAULT_STUDENT_FAQS];

  if (role === "student" && profileData) {
    const studentCardData = cardResult.data;
    const faqRows = faqResult.data;

    const resolvedStudentId = resolveStudentId({
      studentId: profileData.student_id,
      fallbackEmail: user.email,
      userId: user.id,
    });

    studentCard = {
      fullName: profileData.full_name || "Student",
      studentId: resolvedStudentId || profileData.student_id || "N/A",
      cardNumber: studentCardData?.card_number || "Pending assignment",
      department: profileData.department || "General",
      status: (studentCardData?.status as "active" | "pending" | "suspended" | "expired") || "pending",
      expiryDate: studentCardData?.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
      avatarUrl: profileData.avatar_url,
      qrUrl: resolvedStudentId ? getDeterministicQrUrl(resolvedStudentId) : null,
      address: profileData.address,
      phone: profileData.phone,
    };

    if (faqRows && faqRows.length > 0) {
      const byKey = new Map(faqRows.map((row) => [String(row.key), String(row.value ?? "")]));
      const pairs = [];
      for (let i = 1; i <= 4; i += 1) {
        const question = byKey.get(`faq_student_q${i}`) || DEFAULT_STUDENT_FAQS[i - 1]?.question || "";
        const answer = byKey.get(`faq_student_a${i}`) || DEFAULT_STUDENT_FAQS[i - 1]?.answer || "";
        if (question.trim() && answer.trim()) pairs.push({ question, answer });
      }
      if (pairs.length > 0) studentFaqs = pairs;
    }
  }

  return (
    <DashboardClient 
      user={user} 
      role={role} 
      stats={stats} 
      studentCard={studentCard as NonNullable<Parameters<typeof DashboardClient>[0]["studentCard"]>}
      studentFaqs={studentFaqs}
      activeLoansList={stats.activeLoansList}
      violationsList={stats.violationsList}
    />
  );
}
