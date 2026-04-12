import { AuditLogClient } from "@/components/admin/AuditLogClient";
import { getUserRole } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export async function AuditContentContainer() {
  const role = await getUserRole();
  
  if (role !== 'admin') {
    redirect("/dashboard?error=unauthorized");
  }

  return (
    <div className="w-full">
      <AuditLogClient />
    </div>
  );
}
