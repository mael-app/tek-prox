"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "loading" | "connected" | "unreachable" | "node";

export function ProxmoxStatusIndicator() {
  const [status, setStatus] = useState<Status>("loading");

  const check = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch("/api/admin/proxmox-status", { signal: controller.signal });
      if (!res.ok) {
        setStatus("unreachable");
        return;
      }
      const data = await res.json();
      if (data.connected) setStatus("connected");
      else setStatus(data.reason === "node" ? "node" : "unreachable");
    } catch {
      setStatus("unreachable");
    } finally {
      clearTimeout(timer);
    }
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = status === "connected";
  const isLoading = status === "loading";
  const isError = status === "unreachable" || status === "node";

  const label =
    status === "loading" ? "Proxmox API…" :
    status === "connected" ? "Proxmox API" :
    status === "node" ? "Proxmox API" :
    "Proxmox API";

  const badge =
    status === "loading" ? null :
    status === "connected" ? "OK" :
    status === "node" ? "Bad node" :
    "Unreachable";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
        isLoading && "text-muted-foreground",
        isConnected && "text-foreground",
        isError && "text-destructive"
      )}
    >
      {/* Heartbeat dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            isLoading && "bg-muted-foreground",
            isConnected && "bg-green-500",
            isError && "bg-destructive"
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2.5 w-2.5",
            isLoading && "bg-muted-foreground",
            isConnected && "bg-green-500",
            isError && "bg-destructive"
          )}
        />
      </span>

      <span className="leading-none">{label}</span>

      {badge && (
        <span
          className={cn(
            "ml-auto text-xs font-normal",
            isConnected ? "text-green-500" : "text-destructive"
          )}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
