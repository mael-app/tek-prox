import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getProxmoxClient } from "@/lib/proxmox";
import { checkAgentHealth } from "@/lib/agent";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = getProxmoxClient();
  const [{ ok, reason }, agentResult] = await Promise.all([
    client.ping(),
    checkAgentHealth(),
  ]);

  return NextResponse.json({
    proxmox: { connected: ok, reason: reason ?? null },
    agent: { connected: agentResult.ok, commit: agentResult.commit ?? null },
  });
}
