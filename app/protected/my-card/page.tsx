import React from "react";
import { createClient } from "@/lib/supabase/server";
import MyCardContainer from "@/components/library/MyCardContainer";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

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
    const card_number = `LIB-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

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
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <span className="text-red-600 text-2xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Finalizing Setup...</h2>
          <p className="text-zinc-500 mt-2 max-w-xs">
            We're still setting up your secure identity. Please refresh this page in a few seconds.
          </p>
          <a 
            href="/protected/my-card"
            className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors inline-block"
          >
            Refresh Now
          </a>
        </div>
      );
    }
  }

  // 5. Generate QR code SVG on the server
  const qrSvg = await QRCode.toString(finalCard.card_number, {
    type: 'svg',
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  const initialData = {
    fullName: profileData.full_name || "Student",
    studentId: profileData.student_id || "N/A",
    cardNumber: finalCard.card_number,
    department: profileData.department || "No Department",
    status: finalCard.status as "pending" | "active" | "suspended" | "expired",
    expiryDate: finalCard.expires_at || new Date().toISOString(),
    avatarUrl: profileData.avatar_url,
    qrSvg: qrSvg
  };

  return <MyCardContainer initialData={initialData} />;
}

