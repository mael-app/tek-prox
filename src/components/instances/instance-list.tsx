"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Play, Square, Loader2, Copy, Check, Search, X } from "lucide-react";

interface IpAddress {
  address: string;
  gateway: string;
}

interface Instance {
  id: string;
  vmid: number;
  name: string;
  status: string;
  ramMb: number;
  cpuCores: number;
  diskGb: number;
  osTemplate: string;
  ip: IpAddress | null;
  group: { id: string; name: string };
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const colorClass =
    status === "running"
      ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
      : status === "stopped"
        ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
        : "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={colorClass}>
      {status}
    </Badge>
  );
}

export function InstanceList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loadingVmid, setLoadingVmid] = useState<number | null>(null);
  const [copiedVmid, setCopiedVmid] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  function handleCopyIp(e: React.MouseEvent, vmid: number, ip: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedVmid(vmid);
    setTimeout(() => setCopiedVmid(null), 2000);
  }

  const { data: instances, isLoading } = useQuery<Instance[]>({
    queryKey: ["instances"],
    queryFn: () => fetch("/api/instances").then((r) => r.json()),
    refetchInterval: 15_000,
  });

  async function handleAction(e: React.MouseEvent, vmid: number, type: "start" | "stop") {
    e.stopPropagation();
    setLoadingVmid(vmid);
    try {
      const res = await fetch(`/api/instances/${vmid}/${type}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Action failed");
        return;
      }
      toast.success(type === "start" ? "Instance started" : "Instance stopped");
      queryClient.invalidateQueries({ queryKey: ["instances"] });
    } finally {
      setLoadingVmid(null);
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading instances...</p>;
  }

  if (!instances?.length) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No instances yet.</p>
        <Button asChild>
          <Link href="/instances/new">
            <Plus className="h-4 w-4 mr-2" />
            Create your first instance
          </Link>
        </Button>
      </div>
    );
  }

  // Unique groups for the filter dropdown
  const uniqueGroups = Array.from(
    new Map(instances.map((i) => [i.group.id, i.group])).values()
  );

  // Filtered list
  const q = search.toLowerCase().trim();
  const filtered = instances.filter((i) => {
    if (groupFilter !== "all" && i.group.id !== groupFilter) return false;
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      String(i.vmid).includes(q) ||
      (i.ip?.address ?? "").includes(q)
    );
  });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, ID or IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 h-9 rounded-md border border-input bg-transparent text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {uniqueGroups.length > 1 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {uniqueGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VMID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>RAM</TableHead>
            <TableHead>CPU</TableHead>
            <TableHead>Disk</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No instances match your search.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((instance) => (
            <TableRow
              key={instance.id}
              className="cursor-pointer hover:bg-muted/60"
              onClick={() => router.push(`/instances/${instance.vmid}`)}
            >
              <TableCell className="font-mono">{instance.vmid}</TableCell>
              <TableCell className="font-medium">{instance.name}</TableCell>
              <TableCell>
                <StatusBadge status={instance.status} />
              </TableCell>
              <TableCell className="font-mono text-sm">
                {instance.ip?.address ? (
                  <span
                    className="inline-flex items-center gap-1.5 cursor-pointer group"
                    onClick={(e) => handleCopyIp(e, instance.vmid, instance.ip!.address)}
                  >
                    {instance.ip.address}
                    {copiedVmid === instance.vmid ? (
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {instance.group.name}
              </TableCell>
              <TableCell>{instance.ramMb} MB</TableCell>
              <TableCell>{instance.cpuCores}</TableCell>
              <TableCell>{instance.diskGb} GB</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {instance.status === "stopped" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={loadingVmid === instance.vmid}
                    onClick={(e) => handleAction(e, instance.vmid, "start")}
                  >
                    {loadingVmid === instance.vmid ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Start
                  </Button>
                )}
                {instance.status === "running" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={loadingVmid === instance.vmid}
                    onClick={(e) => handleAction(e, instance.vmid, "stop")}
                  >
                    {loadingVmid === instance.vmid ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    Stop
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
