import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { expandRange, hasIpConflict } from "@/lib/ip";

const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

const updateSchema = z.object({
  label: z.string().optional(),
  gateway: z.string().regex(ipv4Regex, "Invalid gateway IP").optional(),
  startIp: z.string().regex(ipv4Regex, "Invalid start IP").optional(),
  endIp: z.string().regex(ipv4Regex, "Invalid end IP").optional(),
  individualIp: z.string().regex(ipv4Regex, "Invalid IP").optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Get current IP range to check if IPs are being changed
  const currentRange = await db.ipRange.findUnique({
    where: { id },
    select: { startIp: true, endIp: true, isIndividual: true },
  });

  if (!currentRange) {
    return NextResponse.json({ error: "IP range not found" }, { status: 404 });
  }

  // Check if IP addresses are being modified
  const startChanged = data.startIp && data.startIp !== currentRange.startIp;
  const endChanged = data.endIp && data.endIp !== currentRange.endIp;
  const individualChanged = data.individualIp && data.individualIp !== currentRange.startIp;

  if (startChanged || endChanged || individualChanged) {
    // Determine new addresses
    let newAddresses: string[];
    if (data.individualIp) {
      newAddresses = [data.individualIp];
    } else if (data.startIp && data.endIp) {
      newAddresses = expandRange(data.startIp, data.endIp);
    } else if (data.startIp && currentRange.endIp) {
      newAddresses = expandRange(data.startIp, currentRange.endIp);
    } else if (data.endIp && currentRange.startIp) {
      newAddresses = expandRange(currentRange.startIp, data.endIp);
    } else {
      newAddresses = [];
    }

    // Check for conflicts (excluding current range)
    if (newAddresses.length > 0) {
      const conflictCheck = await hasIpConflict(newAddresses, id);
      if (conflictCheck.conflict) {
        return NextResponse.json(
          { error: `IP address ${conflictCheck.conflictingIp} is already in use by another range` },
          { status: 409 }
        );
      }
    }
  }

  // For individual IPs, map individualIp to startIp
  if (data.individualIp) {
    data.startIp = data.individualIp;
    delete data.individualIp;
  }

  const ipRange = await db.ipRange.update({
    where: { id },
    data,
    include: { _count: { select: { addresses: true } } },
  });

  audit(session.user, "IP_RANGE_UPDATE", id, {
    label: ipRange.label,
    gateway: ipRange.gateway,
    changes: data,
  });

  return NextResponse.json(ipRange);
}

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
