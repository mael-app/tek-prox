"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ApiStatus = "loading" | "connected" | "unreachable" | "node";
type AgentStatus = "loading" | "connected" | "unreachable";

export function ProxmoxStatusIndicator() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("loading");
  const controllerRef = useRef<AbortController | null>(null);

  const check = async () => {
    // Abort any in-flight request so stale responses never overwrite fresh ones
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch("/api/admin/proxmox-status", { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setApiStatus("unreachable");
        setAgentStatus("unreachable");
        return;
      }
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (data.proxmox.connected) setApiStatus("connected");
      else setApiStatus(data.proxmox.reason === "node" ? "node" : "unreachable");
      setAgentStatus(data.agent.connected ? "connected" : "unreachable");
    } catch {
      // Ignore errors from aborted requests (e.g. Strict Mode cleanup)
      if (controller.signal.aborted) return;
      setApiStatus("unreachable");
      setAgentStatus("unreachable");
    } finally {
      clearTimeout(timer);
    }
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);
    return () => {
      clearInterval(interval);
      // Abort in-flight request on unmount to prevent state updates on dead component
      controllerRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex flex-col gap-0.5">
      <StatusRow
        label="Proxmox API"
        badge={
          apiStatus === "loading" ? null :
          apiStatus === "connected" ? "OK" :
          apiStatus === "node" ? "Bad node" :
          "Unreachable"
        }
        state={
          apiStatus === "loading" ? "loading" :
          apiStatus === "connected" ? "ok" :
          "error"
        }
      />
      <StatusRow
        label="Agent"
        badge={
          agentStatus === "loading" ? null :
          agentStatus === "connected" ? "OK" :
          "Unreachable"
        }
        state={
          agentStatus === "loading" ? "loading" :
          agentStatus === "connected" ? "ok" :
          "error"
        }
      />
    </div>
  );
}

function StatusRow({
  label,
  badge,
  state,
}: {
  label: string;
  badge: string | null;
  state: "loading" | "ok" | "error";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
        state === "loading" && "text-muted-foreground",
        state === "ok" && "text-foreground",
        state === "error" && "text-destructive"
      )}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            state === "loading" && "bg-muted-foreground",
            state === "ok" && "bg-green-500",
            state === "error" && "bg-destructive"
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2.5 w-2.5",
            state === "loading" && "bg-muted-foreground",
            state === "ok" && "bg-green-500",
            state === "error" && "bg-destructive"
          )}
        />
      </span>

      <span className="leading-none">{label}</span>

      {badge && (
        <span
          className={cn(
            "ml-auto text-xs font-normal",
            state === "ok" ? "text-green-500" : "text-destructive"
          )}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
