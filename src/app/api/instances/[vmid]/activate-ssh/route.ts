import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { injectSshKey } from "@/lib/agent";
import axios from "axios";

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

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.sshPublicKey) {
    return NextResponse.json(
      { error: "No SSH public key set. Go to Settings to add one." },
      { status: 400 }
    );
  }

  if (instance.status !== "running") {
    return NextResponse.json(
      { error: "Instance must be running to inject SSH key" },
      { status: 400 }
    );
  }

  try {
    await injectSshKey(vmid, user.sshPublicKey);
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? (err.response?.data?.error ?? err.message)
      : String(err);
    console.error("[activate-ssh] agent error:", message);
    return NextResponse.json({ error: `Agent error: ${message}` }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
