"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CopyableValue } from "@/components/ui/copy-button";

interface IpInfo {
  networkMode: "static" | "dhcp";
  status: string;
  ipAddress: string | null;
  ipStale: boolean;
  ip: { gateway: string } | null;
}

/**
 * IP / gateway rows of the instance details card. DHCP instances are polled
 * so a new lease shows up without reloading the page.
 */
export function InstanceIpDetails({ vmid, initial }: { vmid: number; initial: IpInfo }) {
  const { data } = useQuery<IpInfo>({
    queryKey: ["instance-ip", vmid],
    queryFn: () => fetch(`/api/instances/${vmid}`).then((r) => r.json()),
    initialData: initial,
    enabled: initial.networkMode === "dhcp",
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.status === "running" && (!d.ipAddress || d.ipStale) ? 5_000 : 15_000;
    },
  });

  const isDhcp = initial.networkMode === "dhcp";
  // Static IPs never change: always trust the server-rendered value
  const info = isDhcp ? (data ?? initial) : initial;

  let address: React.ReactNode = info.ipAddress ? (
    <CopyableValue value={info.ipAddress} label="Copy IP Address" />
  ) : (
    "—"
  );
  if (!info.ipAddress && isDhcp && info.status === "running") {
    address = (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Waiting for DHCP…
      </span>
    );
  } else if (info.ipAddress && info.ipStale) {
    address = (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Last known address">
        <CopyableValue value={info.ipAddress} label="Copy IP Address" />
        (last known)
      </span>
    );
  }
  const gateway = isDhcp ? null : (info.ip?.gateway ?? null);

  return (
    <>
      <div>
        <dt className="text-xs text-muted-foreground uppercase tracking-wider">
          IP Address
        </dt>
        <dd className="flex items-center font-medium font-mono text-sm mt-0.5">{address}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground uppercase tracking-wider">
          Gateway
        </dt>
        <dd className="flex items-center font-medium font-mono text-sm mt-0.5">
          {gateway ? (
            <CopyableValue value={gateway} label="Copy Gateway" />
          ) : isDhcp ? (
            "DHCP"
          ) : (
            "—"
          )}
        </dd>
      </div>
    </>
  );
}
