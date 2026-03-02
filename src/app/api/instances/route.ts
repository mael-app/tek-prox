import { NextRequest, NextResponse } from "next/server";
import { isAxiosError } from "axios";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";
import { setUnconfined } from "@/lib/agent";
import { allocateIp } from "@/lib/ip";
import { getNextVmid } from "@/lib/utils/vmid";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  ramMb: z.number().int().min(128),
  cpuCores: z.number().int().min(1),
  diskGb: z.number().int().min(1),
  swapMb: z.number().int().min(0),
  osTemplate: z.string().min(1),
});

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const instances = await db.instance.findMany({
    where: { userId: session.user.id },
    include: { ip: true },
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

  const { name, ramMb, cpuCores, diskGb, swapMb, osTemplate } = parsed.data;

  // Load user's group and check quotas
  const groupMember = await db.groupMember.findFirst({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          instances: {
            where: { userId: session.user.id },
          },
        },
      },
    },
  });

  if (!groupMember) {
    return NextResponse.json(
      { error: "You are not assigned to a group" },
      { status: 403 }
    );
  }

  const { group } = groupMember;
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
      userId: session.user.id,
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

    // Patch config for Docker (unconfined)
    try {
      await setUnconfined(vmid);
    } catch (agentErr) {
      // Rollback: delete LXC from Proxmox, release IP and DB record
      await db.ipAddress.updateMany({
        where: { id: ipRecord.id },
        data: { instanceId: null },
      });
      await db.instance.delete({ where: { id: instance.id } });
      try { await proxmox.deleteLxc(vmid); } catch { /* best-effort */ }
      console.error("Agent call failed:", agentErr);

      const isTimeout = isAxiosError(agentErr) &&
        (agentErr.code === "ECONNABORTED" || agentErr.code === "ECONNREFUSED" || !agentErr.response);

      return NextResponse.json(
        {
          error: isTimeout
            ? "L'agent Proxmox est inaccessible. Vérifiez que le service agent est démarré et que AGENT_BASE_URL est correctement configuré."
            : `L'agent Proxmox a retourné une erreur : ${isAxiosError(agentErr) ? agentErr.message : String(agentErr)}`,
        },
        { status: 503 }
      );
    }

    // Update instance status
    await db.instance.update({
      where: { id: instance.id },
      data: { status: "stopped" },
    });

    const result = await db.instance.findUnique({
      where: { id: instance.id },
      include: { ip: true },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    // Rollback: release IP and delete instance
    await db.ipAddress.updateMany({
      where: { id: ipRecord.id },
      data: { instanceId: null },
    });
    await db.instance.delete({ where: { id: instance.id } });
    console.error("Instance creation failed:", err);

    // Extract the Proxmox error detail when available
    let message = "Failed to create instance on Proxmox.";
    if (isAxiosError(err) && err.response) {
      const data = err.response.data as Record<string, unknown> | undefined;
      if (data?.errors && typeof data.errors === "object") {
        // Proxmox errors object: { field: "message", ... }
        message = Object.entries(data.errors as Record<string, string>)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ");
      } else if (typeof data?.message === "string") {
        message = data.message;
      } else {
        message = `Proxmox error ${err.response.status}: ${err.response.statusText}`;
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
