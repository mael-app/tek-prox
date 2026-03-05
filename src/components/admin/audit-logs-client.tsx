"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

type AuditAction =
  | "GROUP_CREATE"
  | "GROUP_UPDATE"
  | "GROUP_DELETE"
  | "USER_DELETE"
  | "IP_RANGE_CREATE"
  | "IP_RANGE_DELETE"
  | "MEMBER_IMPORT"
  | "INSTANCE_CREATE"
  | "INSTANCE_DELETE"
  | "INSTANCE_UPDATE"
  | "DOCKER_TOGGLE"
  | "SETTINGS_UPDATE";

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string | null;
  action: string;
  targetId: string | null;
  meta: string | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  GROUP_CREATE: "Group created",
  GROUP_UPDATE: "Group updated",
  GROUP_DELETE: "Group deleted",
  USER_DELETE: "User deleted",
  IP_RANGE_CREATE: "IP range added",
  IP_RANGE_DELETE: "IP range deleted",
  MEMBER_IMPORT: "Members imported",
  INSTANCE_CREATE: "Instance created",
  INSTANCE_DELETE: "Instance deleted",
  INSTANCE_UPDATE: "Instance updated",
  DOCKER_TOGGLE: "Docker toggled",
  SETTINGS_UPDATE: "Settings updated",
};

const ACTION_VARIANTS: Record<
  AuditAction,
  "default" | "secondary" | "destructive" | "outline"
> = {
  GROUP_CREATE: "default",
  GROUP_UPDATE: "secondary",
  GROUP_DELETE: "destructive",
  USER_DELETE: "destructive",
  IP_RANGE_CREATE: "default",
  IP_RANGE_DELETE: "destructive",
  MEMBER_IMPORT: "secondary",
  INSTANCE_CREATE: "default",
  INSTANCE_DELETE: "destructive",
  INSTANCE_UPDATE: "secondary",
  DOCKER_TOGGLE: "outline",
  SETTINGS_UPDATE: "secondary",
};



function actionLabel(action: string): string {
  return ACTION_LABELS[action as AuditAction] ?? action;
}

function actionVariant(
  action: string
): "default" | "secondary" | "destructive" | "outline" {
  return ACTION_VARIANTS[action as AuditAction] ?? "outline";
}

function formatMeta(action: string, metaRaw: string | null): string {
  if (!metaRaw) return "—";
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return metaRaw;
  }

  switch (action as AuditAction) {
    case "GROUP_CREATE":
      return `"${meta.name}"`;
    case "GROUP_UPDATE":
      return `"${meta.name}"`;
    case "GROUP_DELETE":
      return `"${meta.name}"`;
    case "USER_DELETE":
      return `${meta.email ?? meta.name ?? "—"}`;
    case "IP_RANGE_CREATE":
      return meta.individualIp
        ? `${meta.individualIp} (1 IP)`
        : `${meta.startIp} → ${meta.endIp} (${meta.count} IPs)`;
    case "IP_RANGE_DELETE":
      return meta.startIp
        ? `${meta.startIp} → ${meta.endIp}`
        : (meta.label as string) ?? "—";
    case "MEMBER_IMPORT":
      return `${meta.groupName}: ${meta.added} added, ${meta.created} created, ${meta.errors} errors`;
    case "INSTANCE_CREATE":
      return `vmid ${meta.vmid} "${meta.name}" — ${meta.cpuCores} vCPU, ${meta.ramMb} MB RAM, ${meta.diskGb} GB (${meta.groupName})`;
    case "INSTANCE_DELETE":
      return `vmid ${meta.vmid} "${meta.name}"${meta.deletedByAdmin ? " (by admin)" : ""}`;
    case "INSTANCE_UPDATE": {
      const changes = meta.changes as Record<string, number | undefined>;
      const parts: string[] = [];
      if (changes.ramMb !== undefined) parts.push(`RAM → ${changes.ramMb} MB`);
      if (changes.cpuCores !== undefined) parts.push(`CPU → ${changes.cpuCores}`);
      if (changes.diskGb !== undefined) parts.push(`disk → ${changes.diskGb} GB`);
      if (changes.swapMb !== undefined) parts.push(`swap → ${changes.swapMb} MB`);
      const suffix = meta.byAdmin ? " (by admin)" : "";
      return `vmid ${meta.vmid}${parts.length ? ": " + parts.join(", ") : ""}${suffix}`;
    }
    case "DOCKER_TOGGLE":
      return `vmid ${meta.vmid} "${meta.name}" → ${meta.enabled ? "enabled" : "disabled"}${meta.toggledByAdmin ? " (by admin)" : ""}`;
    case "SETTINGS_UPDATE": {
      const parts: string[] = [];
      if ((meta.storage as { from: string; to: string })?.from !== (meta.storage as { from: string; to: string })?.to)
        parts.push(`storage: ${(meta.storage as { from: string; to: string }).from} → ${(meta.storage as { from: string; to: string }).to}`);
      if ((meta.bridge as { from: string; to: string })?.from !== (meta.bridge as { from: string; to: string })?.to)
        parts.push(`bridge: ${(meta.bridge as { from: string; to: string }).from} → ${(meta.bridge as { from: string; to: string }).to}`);
      return parts.length ? parts.join(", ") : "No changes";
    }
    default:
      return JSON.stringify(meta);
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ALL_ACTIONS: AuditAction[] = [
  "GROUP_CREATE",
  "GROUP_UPDATE",
  "GROUP_DELETE",
  "USER_DELETE",
  "IP_RANGE_CREATE",
  "IP_RANGE_DELETE",
  "MEMBER_IMPORT",
  "INSTANCE_CREATE",
  "INSTANCE_DELETE",
  "INSTANCE_UPDATE",
  "DOCKER_TOGGLE",
  "SETTINGS_UPDATE",
];

/** Returns the page numbers to display, inserting `null` for ellipsis gaps. */
function buildPageItems(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: (number | null)[] = [1];

  const leftEdge = Math.max(2, current - 1);
  const rightEdge = Math.min(total - 1, current + 1);

  if (leftEdge > 2) items.push(null); // left ellipsis
  for (let p = leftEdge; p <= rightEdge; p++) items.push(p);
  if (rightEdge < total - 1) items.push(null); // right ellipsis

  items.push(total);
  return items;
}

export function AuditLogsClient() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => {
        setDebouncedSearch(value);
        setPage(1);
      },
      300
    );
  }

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (action !== "all") params.set("action", action);
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ["audit-logs", page, limit, action, debouncedSearch],
    queryFn: () =>
      fetch(`/api/admin/audit-logs?${params}`).then((r) => r.json()),
  });

  const firstItem = data ? (page - 1) * limit + 1 : 0;
  const lastItem = data ? Math.min(page * limit, data.total) : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-md border border-input bg-transparent text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ALL_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABELS[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {data && (
          <p className="text-sm text-muted-foreground ml-auto">
            {data.total > 0
              ? `${firstItem}–${lastItem} of ${data.total} event${data.total !== 1 ? "s" : ""}`
              : "0 events"}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Date</TableHead>
              <TableHead className="w-52">User</TableHead>
              <TableHead className="w-40">Action</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : data?.logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  No events yet
                </TableCell>
              </TableRow>
            ) : (
              data?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.userEmail ?? (
                      <span className="text-muted-foreground font-mono text-xs">
                        {log.userId.slice(0, 8)}…
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(log.action)}>
                      {actionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatMeta(log.action, log.meta)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.pages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <Select
              value={String(limit)}
              onValueChange={(v) => {
                setLimit(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page controls */}
          {data.pages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {buildPageItems(page, data.pages).map((item, i) =>
                item === null ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="w-8 text-center text-sm text-muted-foreground select-none"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(item)}
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                  >
                    {item}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= data.pages}
                onClick={() => setPage(data.pages)}
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

