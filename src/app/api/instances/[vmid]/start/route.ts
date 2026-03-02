import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";

type Params = { params: Promise<{ vmid: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);

  const instance = await db.instance.findUnique({ where: { vmid } });
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (instance.userId !== session.user.id && !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const proxmox = getProxmoxClient();
  const upid = await proxmox.startLxc(vmid);
  await proxmox.waitForTask(upid);

  await db.instance.update({
    where: { id: instance.id },
    data: { status: "running" },
  });

  return NextResponse.json({ success: true });
}
