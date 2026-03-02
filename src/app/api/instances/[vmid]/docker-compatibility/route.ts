import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";
import { setUnconfined } from "@/lib/agent";

const bodySchema = z.object({ enabled: z.boolean() });

type Params = { params: Promise<{ vmid: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);

  const parsed = bodySchema.safeParse(await _req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { enabled } = parsed.data;

  // Fetch instance
  const instance = await db.instance.findUnique({
    where: { vmid },
    include: { group: true },
  });

  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check permission: user owns instance or is admin
  if (instance.userId !== session.user.id && !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if user's group allows Docker compatibility
  if (!instance.group.allowDockerCompatibility) {
    return NextResponse.json(
      { error: "Your group does not have Docker compatibility permission" },
      { status: 403 }
    );
  }

  try {
    const proxmox = getProxmoxClient();

    // Check current instance status
    const currentStatus = await proxmox.getLxcStatus(vmid);
    const wasRunning = currentStatus.status === "running";

    // If instance is running, shut it down first
    if (wasRunning) {
      await proxmox.shutdownLxc(vmid);

      // Wait for shutdown with timeout
      let attempts = 0;
      const maxAttempts = 15; // 30 seconds max
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const status = await proxmox.getLxcStatus(vmid);
        if (status.status === "stopped") {
          break;
        }
        attempts++;
      }

      // Verify it's actually stopped
      const finalStatus = await proxmox.getLxcStatus(vmid);
      if (finalStatus.status !== "stopped") {
        throw new Error("Instance did not stop properly after 30 seconds");
      }
    }

    // Apply or remove Docker compatibility configuration via agent
    await setUnconfined(vmid, enabled);

    // If instance was running, start it back up
    if (wasRunning) {
      await proxmox.startLxc(vmid);
    }

    // Update database
    await db.instance.update({
      where: { vmid },
      data: { dockerCompatibilityEnabled: enabled },
    });

    return NextResponse.json({
      success: true,
      dockerCompatibilityEnabled: enabled,
      wasRestarted: wasRunning,
    });
  } catch (error) {
    console.error("Docker compatibility toggle error:", error);
    return NextResponse.json(
      { error: "Failed to toggle Docker compatibility" },
      { status: 500 }
    );
  }
}

