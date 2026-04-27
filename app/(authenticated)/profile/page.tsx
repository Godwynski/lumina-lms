import { createClient } from "@/lib/supabase/server";
import { ProfileSection } from "@/components/settings/sections/ProfileSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function ProfileContent() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url, address, phone, department, status, student_id, email")
    .eq("id", user.id)
    .single();

  return (
    <ProfileSection 
      role={profile?.role || "student"} 
      initialProfile={{
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        address: profile?.address || null,
        phone: profile?.phone || null,
        department: profile?.department || null,
        status: profile?.status || 'PENDING',
        student_id: profile?.student_id || null,
        email: profile?.email || null,
      }} 
    />
  );
}

export default function ProfilePage() {
  return (
    <div className="space-y-6 w-full">

      <Suspense fallback={<div className="p-8 animate-pulse space-y-8"><div className="h-8 w-48 bg-muted rounded" /><div className="h-96 w-full bg-muted rounded" /></div>}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

