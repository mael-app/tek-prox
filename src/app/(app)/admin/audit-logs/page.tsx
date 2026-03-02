import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { AuditLogsClient } from "@/components/admin/audit-logs-client";

export default async function AuditLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Audit Logs</h1>
      <p className="text-sm text-muted-foreground mb-6">
        History of sensitive and destructive operations performed on the platform.
      </p>
      <AuditLogsClient />
    </div>
  );
}
