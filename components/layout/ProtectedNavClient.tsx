"use client";

import dynamic from "next/dynamic";

const ProtectedNavNoSSR = dynamic(
  () => import("@/components/layout/ProtectedNav").then((module) => module.ProtectedNav),
  {
    ssr: false,
    loading: () => null,
  },
);

export function ProtectedNavClient({
  role,
  user,
  profile,
}: {
  role?: string | null;
  user?: any;
  profile?: any;
}) {
  return <ProtectedNavNoSSR role={role} user={user} profile={profile} />;
}
