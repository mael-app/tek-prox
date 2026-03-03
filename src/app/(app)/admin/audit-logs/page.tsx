import { AuditLogsClient } from "@/components/admin/audit-logs-client";

export default function AuditLogsPage() {

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
