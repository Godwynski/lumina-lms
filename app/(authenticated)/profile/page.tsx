import { getMe } from "@/lib/auth-helpers";
import { ProfileSection } from "@/components/settings/sections/ProfileSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";

// getMe() is cache()-memoized — reuses auth already fetched by the layout
function buildProfilePromise() {
  return getMe().then(async (me) => {
    if (!me) redirect("/login");
    const { user, profile } = me;
    return { user, profile };
  });
}

async function ProfileContent() {
  const { profile } = await buildProfilePromise();

  return (
    <ProfileSection
      role={profile?.role || "student"}
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
    <div className="space-y-6 w-full">
      <Suspense fallback={<div className="p-8 animate-pulse space-y-8"><div className="h-8 w-48 bg-muted rounded" /><div className="h-96 w-full bg-muted rounded" /></div>}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
