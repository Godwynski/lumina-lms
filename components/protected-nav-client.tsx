"use client";

import dynamic from "next/dynamic";

const ProtectedNavNoSSR = dynamic(
  () => import("@/components/protected-nav").then((module) => module.ProtectedNav),
  {
    ssr: false,
    loading: () => null,
  },
);

export function ProtectedNavClient({
  role,
  authNode,
}: {
  role?: string | null;
  authNode?: React.ReactNode;
}) {
  return <ProtectedNavNoSSR role={role} authNode={authNode} />;
}
