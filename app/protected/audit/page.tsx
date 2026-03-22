import { redirect } from "next/navigation";

export const metadata = {
  title: "Audit Logs | Lumina LMS",
};

export default function AuditPage() {
  redirect("/protected/settings?tab=audit");
}
