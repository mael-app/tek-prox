import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getProxmoxClient } from "@/lib/proxmox";

async function adminCheck() {
  const session = await requireSession();
  if (!session?.user.isAdmin) return null;
  return session;
}

export async function GET() {
  if (!(await adminCheck())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const client = getProxmoxClient();
    await client.getNextVmid({ timeout: 5000 });
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
