"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ApiStatus = "loading" | "connected" | "unreachable" | "node";
type AgentStatus = "loading" | "connected" | "unreachable";

export function ProxmoxStatusIndicator() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("loading");
  const [agentCommit, setAgentCommit] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const check = async () => {
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
      setAgentCommit(data.agent.commit ?? null);
    } catch {
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
      controllerRef.current?.abort();
    };
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
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
          commit={agentCommit}
        />
      </div>
    </TooltipProvider>
  );
}

function StatusRow({
  label,
  badge,
  state,
  commit,
}: {
  label: string;
  badge: string | null;
  state: "loading" | "ok" | "error";
  commit?: string | null;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
        state === "loading" && "text-muted-foreground",
        state === "ok" && "text-foreground",
        state === "error" && "text-destructive",
        commit && "cursor-default"
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

  if (!commit) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right">
        <span className="font-mono text-xs">{commit}</span>
      </TooltipContent>
    </Tooltip>
  );
}
