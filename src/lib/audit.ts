import { db } from "@/lib/db";

export type AuditAction =
  | "GROUP_CREATE"
  | "GROUP_UPDATE"
  | "GROUP_DELETE"
  | "USER_DELETE"
  | "IP_RANGE_CREATE"
  | "IP_RANGE_DELETE"
  | "MEMBER_IMPORT"
  | "INSTANCE_CREATE"
  | "INSTANCE_DELETE"
  | "DOCKER_TOGGLE";

interface AuditActor {
  id: string;
  email?: string | null;
}

/**
 * Write an audit log entry. Fire-and-forget: errors are logged but never
 * propagate to the caller so that audit failures never break core operations.
 */
export function audit(
  actor: AuditActor,
  action: AuditAction,
  targetId?: string,
  meta?: Record<string, unknown>
): void {
  db.auditLog
    .create({
      data: {
        userId: actor.id,
        userEmail: actor.email ?? null,
        action,
        targetId: targetId ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    })
    .catch((err) => console.error("[audit] failed to write log:", err));
}
