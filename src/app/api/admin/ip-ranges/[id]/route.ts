import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Check if any addresses in this range are allocated
  const allocated = await db.ipAddress.count({
    where: { ipRangeId: id, instanceId: { not: null } },
  });

  if (allocated > 0) {
    return NextResponse.json(
      { error: `${allocated} address(es) are in use and cannot be deleted` },
      { status: 409 }
    );
  }

  const ipRange = await db.ipRange.findUnique({
    where: { id },
    select: { label: true, startIp: true, endIp: true },
  });
  await db.ipRange.delete({ where: { id } });

  audit(session.user, "IP_RANGE_DELETE", id, {
    label: ipRange?.label,
    startIp: ipRange?.startIp,
    endIp: ipRange?.endIp,
  });

  return NextResponse.json({ success: true });
}
