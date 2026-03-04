"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Timer, Cpu, Bot } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnStatus = "loading" | "ok" | "error";

interface StatusData {
  proxmox: ConnStatus;
  proxmoxReason: string | null;
  agent: ConnStatus;
  agentCommit: string | null;
  uptime: number | null; // seconds
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

// ─── Dot indicator ────────────────────────────────────────────────────────────

function Dot({ state }: { state: ConnStatus }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className={cn(
          "animate-ping absolute inline-flex h-full w-full rounded-full opacity-60",
          state === "loading" && "bg-muted-foreground",
          state === "ok" && "bg-green-500",
          state === "error" && "bg-destructive"
        )}
      />
      <span
        className={cn(
          "relative inline-flex rounded-full h-2 w-2",
          state === "loading" && "bg-muted-foreground",
          state === "ok" && "bg-green-500",
          state === "error" && "bg-destructive"
        )}
      />
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ServerStatusPanel() {
  const [data, setData] = useState<StatusData>({
    proxmox: "loading",
    proxmoxReason: null,
    agent: "loading",
    agentCommit: null,
    uptime: null,
  });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uptimeSyncedRef = useRef(false);

  const fetchAll = async () => {
    try {
      const [statusRes, uptimeRes] = await Promise.all([
        fetch("/api/admin/proxmox-status"),
        fetch("/api/uptime"),
      ]);

      setData((prev) => {
        const next = { ...prev };

        if (statusRes.ok) {
          statusRes.json().then((d) => {
            setData((p) => ({
              ...p,
              proxmox: d.proxmox.connected ? "ok" : "error",
              proxmoxReason: d.proxmox.reason ?? null,
              agent: d.agent.connected ? "ok" : "error",
              agentCommit: d.agent.commit ?? null,
            }));
          });
        } else {
          next.proxmox = "error";
          next.agent = "error";
        }

        if (uptimeRes.ok) {
          uptimeRes.json().then((d) => {
            setData((p) => ({ ...p, uptime: d.uptime as number }));
            uptimeSyncedRef.current = true;
          });
        }

        return next;
      });
    } catch {
      setData((prev) => ({ ...prev, proxmox: "error", agent: "error" }));
    }
  };

  // Re-sync with server every 30s
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Local uptime tick every second
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setData((prev) =>
        prev.uptime !== null ? { ...prev, uptime: prev.uptime + 1 } : prev
      );
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2">
        {/* Uptime — en premier pour éviter les décalages */}
        <div className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap min-w-[6rem]">
            {data.uptime === null ? "…" : `Up ${formatUptime(data.uptime)}`}
          </span>
        </div>

        <span className="h-3.5 w-px bg-border shrink-0" />

        {/* Proxmox API */}
        <StatusCell
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="Proxmox API"
          state={data.proxmox}
        />

        <span className="h-3.5 w-px bg-border shrink-0" />

        {/* Agent */}
        <StatusCell
          icon={<Bot className="h-3.5 w-3.5" />}
          label="Agent"
          state={data.agent}
          tooltip={data.agentCommit ? `commit: ${data.agentCommit}` : undefined}
        />
      </div>
    </TooltipProvider>
  );
}

// ─── StatusCell ───────────────────────────────────────────────────────────────

function StatusCell({
  icon,
  label,
  state,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  state: ConnStatus;
  tooltip?: string;
}) {
  const inner = (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <Dot state={state} />
      <span
        className={cn(
          "text-sm",
          state === "ok" && "text-foreground",
          state === "error" && "text-destructive",
          state === "loading" && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );

  if (!tooltip) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        <span className="font-mono text-xs">{tooltip}</span>
      </TooltipContent>
    </Tooltip>
  );
}
