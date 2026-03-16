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

  // If card doesn't exist yet, show the setup state
  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-zinc-900">Setting up your account...</h2>
        <p className="text-zinc-500 mt-2 max-w-xs">
          Your library card is being generated. This usually takes up to 5 minutes. Please refresh this page shortly.
        </p>
      </div>
    );
  }

  // Generate QR code SVG on the server
  // This is fast enough but we only do it after we have all data
  const qrSvg = await QRCode.toString(card.card_number, {
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
    cardNumber: card.card_number,
    department: profileData.department || "No Department",
    status: card.status as "pending" | "active" | "suspended" | "expired",
    expiryDate: card.expires_at || new Date().toISOString(),
    avatarUrl: profileData.avatar_url,
    qrSvg: qrSvg
  };

  return <MyCardContainer initialData={initialData} />;
}

