import React from "react";
import { createClient } from "@/lib/supabase/server";
import DigitalCard from "@/components/library/DigitalCard";
import CardActions from "@/components/library/CardActions";
import { redirect } from "next/navigation";

export default async function MyCardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
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

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">My Digital Card</h1>
        <p className="text-zinc-500">Your official library identity card</p>
      </div>

      <DigitalCard
        fullName={profile.full_name || "Student"}
        studentId={profile.student_id || "N/A"}
        cardNumber={card.card_number}
        department={profile.department || "No Department"}
        status={card.status as any}
        expiryDate={card.expires_at || new Date().toISOString()}
        avatarUrl={profile.avatar_url}
      />

      <CardActions cardNumber={card.card_number} />

      <div className="mt-12 bg-zinc-50 border border-zinc-100 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mb-4">Quick Guide</h3>
        <ul className="space-y-3 text-sm text-zinc-600">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">1</span>
            Present this QR code to the librarian during checkout.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">2</span>
            Ensure your screen is clean for easy scanning.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">3</span>
            Downloading the card as a PNG allows for offline use.
          </li>
        </ul>
      </div>
    </div>
  );
}
