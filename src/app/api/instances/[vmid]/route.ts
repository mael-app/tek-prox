import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";
import { releaseIp } from "@/lib/ip";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

const patchSchema = z.object({
  ramMb: z.number().int().min(128).optional(),
  cpuCores: z.number().int().min(1).optional(),
  diskGb: z.number().int().min(1).optional(),
  swapMb: z.number().int().min(0).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);

  const instance = await db.instance.findUnique({
    where: { vmid },
    include: { group: true },
  });

  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (instance.userId !== session.user.id && !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { ramMb, cpuCores, diskGb, swapMb } = parsed.data;
  const group = instance.group;

  // Enforce quotas for non-admins
  if (!session.user.isAdmin) {
    if (ramMb !== undefined && ramMb > group.maxRamMb)
      return NextResponse.json({ error: `RAM exceeds the group limit (${group.maxRamMb} MB)` }, { status: 422 });
    if (cpuCores !== undefined && cpuCores > group.maxCpuCores)
      return NextResponse.json({ error: `CPU exceeds the group limit (${group.maxCpuCores} cores)` }, { status: 422 });
    if (diskGb !== undefined && diskGb > group.maxDiskGb)
      return NextResponse.json({ error: `Disk exceeds the group limit (${group.maxDiskGb} GB)` }, { status: 422 });
    if (swapMb !== undefined && group.maxSwapMb > 0 && swapMb > group.maxSwapMb)
      return NextResponse.json({ error: `Swap exceeds the group limit (${group.maxSwapMb} MB)` }, { status: 422 });
  }

  // Disk can only increase
  if (diskGb !== undefined && diskGb < instance.diskGb) {
    return NextResponse.json({ error: "Disk size cannot be reduced" }, { status: 422 });
  }

  try {
    const proxmox = getProxmoxClient();

    // Update RAM, CPU, swap via config
    const configUpdate: { memory?: number; cores?: number; swap?: number } = {};
    if (ramMb !== undefined) configUpdate.memory = ramMb;
    if (cpuCores !== undefined) configUpdate.cores = cpuCores;
    if (swapMb !== undefined) configUpdate.swap = swapMb;

    if (Object.keys(configUpdate).length > 0) {
      await proxmox.updateLxcConfig(vmid, configUpdate);
    }

    // Resize disk if changed
    if (diskGb !== undefined && diskGb !== instance.diskGb) {
      await proxmox.resizeLxcDisk(vmid, diskGb);
    }
  } catch (err) {
    console.error("Failed to update LXC on Proxmox:", err);
    return NextResponse.json({ error: "Proxmox update failed" }, { status: 502 });
  }

  // Update DB
  const updated = await db.instance.update({
    where: { id: instance.id },
    data: {
      ramMb: ramMb ?? instance.ramMb,
      cpuCores: cpuCores ?? instance.cpuCores,
      diskGb: diskGb ?? instance.diskGb,
      swapMb: swapMb ?? instance.swapMb,
    },
  });

  audit(session.user, "INSTANCE_UPDATE", instance.id, {
    vmid: instance.vmid,
    changes: { ramMb, cpuCores, diskGb, swapMb },
    byAdmin: instance.userId !== session.user.id,
  });

  revalidatePath(`/instances/${vmid}`);

  return NextResponse.json(updated);
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

  // Invalidate the dashboard server-component cache so quota usage is fresh.
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true });
}
