import { getMe } from "@/lib/auth-helpers";
import { ProfileSection } from "@/components/settings/sections/ProfileSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProfileLoading from "./loading";

export const metadata = { title: "My Profile" };

async function ProfileContent() {
  const me = await getMe();
  if (!me) redirect("/");
  const { profile } = me;

  return (
    <ProfileSection
      role={profile?.role || "patron"}
      initialProfile={{
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        address: profile?.address || null,
        phone: profile?.phone || null,
        department: profile?.department || null,
        status: profile?.status || "PENDING",
        student_id: profile?.student_id || null,
        email: profile?.email || null,
      }}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileContent />
    </Suspense>
  );
}
