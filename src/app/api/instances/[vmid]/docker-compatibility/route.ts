import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";
import { setUnconfined } from "@/lib/agent";

type Params = { params: Promise<{ vmid: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);
  const { enabled } = await _req.json();

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

    if (enabled) {
      // Enable Docker compatibility: shutdown, apply config, start
      await proxmox.shutdownLxc(vmid);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for shutdown

      // Verify it's actually stopped
      const status = await proxmox.getLxcStatus(vmid);
      if (status.status !== "stopped") {
        throw new Error("Instance did not stop properly");
      }

      // Apply config via agent
      await setUnconfined(vmid, true);

      // Start the instance
      await proxmox.startLxc(vmid);

      // Update database
      await db.instance.update({
        where: { vmid },
        data: { dockerCompatibilityEnabled: true },
      });
    } else {
      // Disable Docker compatibility: shutdown, remove config, start
      await proxmox.shutdownLxc(vmid);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for shutdown

      // Verify it's actually stopped
      const status = await proxmox.getLxcStatus(vmid);
      if (status.status !== "stopped") {
        throw new Error("Instance did not stop properly");
      }

      // Remove config via agent
      await setUnconfined(vmid, false);

      // Start the instance
      await proxmox.startLxc(vmid);

      // Update database
      await db.instance.update({
        where: { vmid },
        data: { dockerCompatibilityEnabled: false },
      });
    }

    return NextResponse.json({
      success: true,
      dockerCompatibilityEnabled: enabled,
    });
  } catch (error) {
    console.error("Docker compatibility toggle error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

