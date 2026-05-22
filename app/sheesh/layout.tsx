import { Metadata } from "next";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Developer Control Panel | Lumina LMS",
  description: "DevOps utilities to clear database records and re-seed mock data.",
};

export default function SheeshLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
