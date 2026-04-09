import { AuditLogClient } from "@/components/admin/AuditLogClient";
import { getUserRole } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export async function AuditContentContainer() {
  const role = await getUserRole();
  
  if (role !== 'admin') {
    redirect("/protected?error=unauthorized");
  }

  return (
    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
      <AuditLogClient />
    </div>
  );
}
