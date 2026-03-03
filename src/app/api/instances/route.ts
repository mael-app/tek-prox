import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";
import { allocateIp } from "@/lib/ip";
import { getNextVmid } from "@/lib/utils/vmid";
import { isAxiosError } from "axios";
import { audit } from "@/lib/audit";
const createSchema = z.object({
  name: z.string().min(1).max(64),
  ramMb: z.number().int().min(128),
  cpuCores: z.number().int().min(1),
  diskGb: z.number().int().min(1),
  swapMb: z.number().int().min(0),
  osTemplate: z.string().min(1),
  groupId: z.string().min(1),
  targetUserId: z.string().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = session.user.isAdmin ? {} : { userId: session.user.id };

  const instances = await db.instance.findMany({
    where,
    include: {
      ip: true,
      group: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(instances);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, ramMb, cpuCores, diskGb, swapMb, osTemplate, groupId, targetUserId } = parsed.data;

  // Determine the owner of the instance (admin may specify a target user)
  let ownerId = session.user.id;
  if (targetUserId && targetUserId !== session.user.id) {
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }
    const membership = await db.groupMember.findFirst({
      where: { userId: targetUserId, groupId },
    });
    if (!membership) {
      return NextResponse.json({ error: "Target user is not a member of this group" }, { status: 403 });
    }
    ownerId = targetUserId;
  }

  // Load the requested group and verify membership (unless admin creating for self)
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: {
      instances: { where: { userId: ownerId } },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (!session.user.isAdmin) {
    const membership = await db.groupMember.findFirst({
      where: { userId: session.user.id, groupId },
    });
    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
    }
  }
  const currentInstances = group.instances.length;

  if (currentInstances >= group.maxInstances) {
    return NextResponse.json(
      { error: `Instance limit reached (${group.maxInstances})` },
      { status: 403 }
    );
  }
  if (ramMb > group.maxRamMb) {
    return NextResponse.json(
      { error: `RAM exceeds group limit (${group.maxRamMb} MB)` },
      { status: 403 }
    );
  }
  if (cpuCores > group.maxCpuCores) {
    return NextResponse.json(
      { error: `CPU cores exceed group limit (${group.maxCpuCores})` },
      { status: 403 }
    );
  }
  if (diskGb > group.maxDiskGb) {
    return NextResponse.json(
      { error: `Disk exceeds group limit (${group.maxDiskGb} GB)` },
      { status: 403 }
    );
  }
  if (group.maxSwapMb > 0 && swapMb > group.maxSwapMb) {
    return NextResponse.json(
      { error: `Swap exceeds group limit (${group.maxSwapMb} MB)` },
      { status: 403 }
    );
  }

  // Validate osTemplate exists in DB
  const templateRecord = await db.osTemplate.findUnique({
    where: { template: osTemplate },
  });
  if (!templateRecord) {
    return NextResponse.json(
      { error: "Invalid OS template" },
      { status: 400 }
    );
  }

  // Fetch infrastructure settings
  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global", storage: "local-lvm", bridge: "vmbr0" },
    update: {},
  });

  // Pick VMID
  const vmid = await getNextVmid();
  const node = process.env.PROXMOX_NODE ?? "pve";

  // Create a placeholder instance first to claim the ID atomically
  const instance = await db.instance.create({
    data: {
      vmid,
      name,
      userId: ownerId,
      groupId: group.id,
      ramMb,
      cpuCores,
      diskGb,
      swapMb,
      osTemplate,
      node,
      status: "creating",
    },
  });

  // Atomically claim a free IP
  const ipRecord = await allocateIp(instance.id);
  if (!ipRecord) {
    await db.instance.delete({ where: { id: instance.id } });
    return NextResponse.json(
      { error: "No available IP addresses" },
      { status: 503 }
    );
  }

  try {
    const proxmox = getProxmoxClient();

    const net0 = `name=eth0,bridge=${settings.bridge},ip=${ipRecord.address}/24,gw=${ipRecord.gateway}`;

    const upid = await proxmox.createLxc({
      vmid,
      hostname: name,
      ostemplate: osTemplate,
      memory: ramMb,
      cores: cpuCores,
      rootfs: `${settings.storage}:${diskGb}`,
      net0,
      swap: swapMb,
      unprivileged: 1,
      start: 0,
    });

    await proxmox.waitForTask(upid);


    // Update instance status
    await db.instance.update({
      where: { id: instance.id },
      data: { status: "stopped" },
    });

    const result = await db.instance.findUnique({
      where: { id: instance.id },
      include: { ip: true },
    });

    audit(session.user, "INSTANCE_CREATE", instance.id, {
      vmid,
      name,
      groupId: group.id,
      groupName: group.name,
      ramMb,
      cpuCores,
      diskGb,
      ...(ownerId !== session.user.id && { onBehalfOf: ownerId }),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    // Rollback: release IP and delete instance
    await db.ipAddress.updateMany({
      where: { id: ipRecord.id },
      data: { instanceId: null },
    });
    await db.instance.delete({ where: { id: instance.id } });
    // Log the full error server-side for debugging
    console.error("Instance creation failed:", err);

    // Return a user-friendly message without leaking internal Proxmox details
    let message = "Failed to create instance on Proxmox.";
    if (isAxiosError(err) && err.response) {
      const data = err.response.data as Record<string, unknown> | undefined;
      if (data?.errors && typeof data.errors === "object") {
        // Proxmox validation errors — expose only the value strings, not field keys
        const values = Object.values(data.errors as Record<string, string>).filter(
          (v) => typeof v === "string" && v.length < 200
        );
        if (values.length > 0) message = values.join(". ");
      } else if (typeof data?.message === "string" && data.message.length < 200) {
        message = data.message;
      }
      // Deliberately omit: status codes, statusText, internal paths
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
