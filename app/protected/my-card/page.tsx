import React from "react";
import { createClient } from "@/lib/supabase/server";
import MyCardContainer from "@/components/library/MyCardContainer";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getUserRole } from "@/lib/auth-helpers";

export default async function MyCardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  // Restrict access to Students and Staff only
  const role = await getUserRole();
  if (role === 'admin' || role === 'librarian') {
    return redirect("/protected");
  }


  // Fetch profile and library card
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, student_id, department, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: card } = await supabase
    .from("library_cards")
    .select("card_number, status, expires_at")
    .eq("user_id", user.id)
    .single();

  if (!profile || !card) {
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
  // This is much faster than client-side rendering and prevents "flicker"
  const qrSvg = await QRCode.toString(card.card_number, {
    type: 'svg',
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  const initialData = {
    fullName: profile.full_name || "Student",
    studentId: profile.student_id || "N/A",
    cardNumber: card.card_number,
    department: profile.department || "No Department",
    status: card.status as any,
    expiryDate: card.expires_at || new Date().toISOString(),
    avatarUrl: profile.avatar_url,
    qrSvg: qrSvg
  };

  return <MyCardContainer initialData={initialData} />;
}

