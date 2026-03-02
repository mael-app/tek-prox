"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ExternalLink } from "lucide-react";

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
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "running"
      ? "default"
      : status === "stopped"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

export function InstanceList() {
  const { data: instances, isLoading } = useQuery<Instance[]>({
    queryKey: ["instances"],
    queryFn: () => fetch("/api/instances").then((r) => r.json()),
    refetchInterval: 15_000,
  });

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>VMID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>IP</TableHead>
          <TableHead>RAM</TableHead>
          <TableHead>CPU</TableHead>
          <TableHead>Disk</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((instance) => (
          <TableRow key={instance.id}>
            <TableCell className="font-mono">{instance.vmid}</TableCell>
            <TableCell className="font-medium">{instance.name}</TableCell>
            <TableCell>
              <StatusBadge status={instance.status} />
            </TableCell>
            <TableCell className="font-mono text-sm">
              {instance.ip?.address ?? "—"}
            </TableCell>
            <TableCell>{instance.ramMb} MB</TableCell>
            <TableCell>{instance.cpuCores}</TableCell>
            <TableCell>{instance.diskGb} GB</TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/instances/${instance.vmid}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
