"use client";

import dynamic from "next/dynamic";

const ProtectedNavNoSSR = dynamic(
  () => import("@/components/layout/ProtectedNav").then((module) => module.ProtectedNav),
  {
    ssr: false,
    loading: () => null,
  },
);

import type { User } from "@supabase/supabase-js";

interface Profile {
  full_name?: string | null;
  avatar_url?: string | null;
}

export function ProtectedNavClient({
  role,
  user,
  profile,
}: {
  role?: string | null;
  user?: User | null;
  profile?: Profile | null;
}) {
  return <ProtectedNavNoSSR role={role} user={user} profile={profile} />;
}
