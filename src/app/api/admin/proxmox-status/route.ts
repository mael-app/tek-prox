import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getProxmoxClient } from "@/lib/proxmox";
import { checkAgentHealth } from "@/lib/agent";

async function adminCheck() {
  const session = await requireSession();
  if (!session?.user.isAdmin) return null;
  return session;
}

export async function GET() {
  if (!(await adminCheck())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = getProxmoxClient();
  const [{ ok, reason }, agentOk] = await Promise.all([
    client.ping(),
    checkAgentHealth(),
  ]);

  return NextResponse.json({
    proxmox: { connected: ok, reason: reason ?? null },
    agent: { connected: agentOk },
  });
}
