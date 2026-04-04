import React from "react";
import { createClient } from "@/lib/supabase/server";
import MyCardContainer from "@/components/library/MyCardContainer";
import { redirect } from "next/navigation";
import {
  getDeterministicQrUrl,
  resolveStudentId,
} from "@/lib/library-card-assets";


export default async function MyCardPage() {
  const supabase = await createClient();

  // 1. Get user - single auth API call
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  // 2. Optimized: Single DB query for profile and card status using Join
  // This reduces round-trips from 3 to 1
  const { data: profileData } = await supabase
    .from("profiles")
    .select(`
      full_name, 
      student_id, 
      department, 
      avatar_url, 
      role,
      address,
      phone,
      library_cards (
        card_number, 
        status, 
        expires_at
      )
    `)
    .eq("id", user.id)
    .single();

  if (!profileData) {
    return redirect("/protected"); // Or some error state
  }

  // 3. Early Role Check from the same data
  if (profileData.role === 'admin' || profileData.role === 'librarian') {
    return redirect("/protected");
  }

  const card = profileData.library_cards?.[0];
  let finalCard = card;

  // 4. Fallback generation when trigger-created card is not visible yet.
  if (!finalCard) {
    const uuidFrag = crypto.randomUUID().split('-')[0].toUpperCase();
    const card_number = `LIB-${new Date().getFullYear()}-${uuidFrag}`;

    const { data: newCard } = await supabase
      .from("library_cards")
      .insert({
        user_id: user.id,
        card_number: card_number,
        status: "pending",
        expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
      })
      .select()
      .single();

    if (newCard) {
      finalCard = newCard;
    }

    // If insert failed (e.g. duplicate key/race), try one more direct read.
    if (!finalCard) {
      const { data: existingCard } = await supabase
        .from("library_cards")
        .select("card_number, status, expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingCard) {
        finalCard = existingCard;
      }
    }

    if (!finalCard) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <span className="text-red-600 text-2xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Finalizing Setup...</h2>
          <p className="text-zinc-500 mt-2 max-w-xs">
            We&apos;re still setting up your secure identity. Please refresh this page in a few seconds.
          </p>
          <a 
            href="/protected/my-card"
            className="mt-6 inline-block rounded-xl bg-slate-900 px-6 py-2 font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Refresh Now
          </a>
        </div>
      );
    }
  }

  const resolvedStudentId = resolveStudentId({
    studentId: profileData.student_id,
    fallbackEmail: user.email,
    userId: user.id,
  });

  const studentId = resolvedStudentId || profileData.student_id || "N/A";
  const qrUrl = resolvedStudentId ? getDeterministicQrUrl(resolvedStudentId) : null;

  const initialData = {
    fullName: profileData.full_name || "Student",
    studentId,
    cardNumber: finalCard.card_number,
    department: profileData.department || "No Department",
    status: finalCard.status as "pending" | "active" | "suspended" | "expired",
    expiryDate: finalCard.expires_at || new Date().toISOString(),
    avatarUrl: profileData.avatar_url,
    qrUrl,
    address: profileData.address,
    phone: profileData.phone,
  };

  return <MyCardContainer initialData={initialData} />;
}

