import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";
import { releaseIp } from "@/lib/ip";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ vmid: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);

  const instance = await db.instance.findUnique({
    where: { vmid },
    include: { ip: true },
  });

  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (instance.userId !== session.user.id && !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch live status from Proxmox
  try {
    const proxmox = getProxmoxClient();
    const liveStatus = await proxmox.getLxcStatus(vmid);
    return NextResponse.json({ ...instance, liveStatus });
  } catch {
    return NextResponse.json(instance);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);

  const instance = await db.instance.findUnique({
    where: { vmid },
    include: { ip: true },
  });

  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (instance.userId !== session.user.id && !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const proxmox = getProxmoxClient();
    // Stop first if running
    try {
      const status = await proxmox.getLxcStatus(vmid);
      if (status.status === "running") {
        const upid = await proxmox.stopLxc(vmid);
        await proxmox.waitForTask(upid);
      }
    } catch {
      // Ignore if can't get status
    }

    const upid = await proxmox.deleteLxc(vmid);
    await proxmox.waitForTask(upid);
  } catch (err) {
    console.error("Failed to delete LXC:", err);
    // Continue with DB cleanup even if Proxmox fails
  }

  // Release IP
  await releaseIp(instance.id);

  // Delete from DB
  await db.instance.delete({ where: { id: instance.id } });

  audit(session.user, "INSTANCE_DELETE", instance.id, {
    vmid: instance.vmid,
    name: instance.name,
    ownerId: instance.userId,
    deletedByAdmin: instance.userId !== session.user.id,
  });

  return NextResponse.json({ success: true });
}
