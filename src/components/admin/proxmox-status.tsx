"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "loading" | "connected" | "disconnected";

export function ProxmoxStatusIndicator() {
  const [status, setStatus] = useState<Status>("loading");

  const check = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch("/api/admin/proxmox-status", { signal: controller.signal });
      if (!res.ok) {
        setStatus("disconnected");
        return;
      }
      const data = await res.json();
      setStatus(data.connected ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
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

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
        isLoading && "text-muted-foreground",
        !isLoading && isConnected && "text-foreground",
        !isLoading && !isConnected && "text-destructive"
      )}
    >
      {/* Heartbeat dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            isLoading && "bg-muted-foreground",
            !isLoading && isConnected && "bg-green-500",
            !isLoading && !isConnected && "bg-destructive"
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2.5 w-2.5",
            isLoading && "bg-muted-foreground",
            !isLoading && isConnected && "bg-green-500",
            !isLoading && !isConnected && "bg-destructive"
          )}
        />
      </span>

      <span className="leading-none">
        {isLoading ? "Proxmox API…" : isConnected ? "Proxmox API" : "Proxmox API"}
      </span>

      {!isLoading && (
        <span
          className={cn(
            "ml-auto text-xs font-normal",
            isConnected ? "text-green-500" : "text-destructive"
          )}
        >
          {isConnected ? "OK" : "KO"}
        </span>
      )}
    </div>
  );
}
