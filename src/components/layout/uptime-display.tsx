"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function UptimeDisplay() {
  const [uptime, setUptime] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUptime = async () => {
    try {
      const res = await fetch("/api/uptime");
      if (!res.ok) return;
      const data = await res.json();
      setUptime(data.uptime as number);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchUptime();

    // Re-sync with server every 60s
    const syncInterval = setInterval(fetchUptime, 60_000);

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  // Local tick every second once we have the initial value
  useEffect(() => {
    if (uptime === null) return;

    tickRef.current = setInterval(() => {
      setUptime((prev) => (prev !== null ? prev + 1 : null));
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [uptime === null]); // only re-run when we go from null → value

  return (
    <div className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">
      <Timer className="h-3.5 w-3.5 shrink-0" />
      <span className="leading-none text-xs">
        {uptime === null ? "…" : `Up ${formatUptime(uptime)}`}
      </span>
    </div>
  );
}
