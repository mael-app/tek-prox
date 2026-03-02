import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { injectSshKey } from "@/lib/agent";

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

  await injectSshKey(vmid, user.sshPublicKey);

  return NextResponse.json({ success: true });
}
