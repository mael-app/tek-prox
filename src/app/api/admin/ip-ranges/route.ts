import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { expandRange } from "@/lib/ip";

const ipv4 = z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IPv4 address");

const ipRangeSchema = z
  .object({
    label: z.string().optional(),
    gateway: ipv4,
    // Either a range or individual IPs
    startIp: ipv4.optional(),
    endIp: ipv4.optional(),
    individualIp: ipv4.optional(),
  })
  .refine(
    (d) =>
      (d.startIp && d.endIp) || d.individualIp,
    { message: "Provide startIp+endIp for a range, or individualIp for a single IP" }
  );

export async function GET() {
  const session = await requireSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ranges = await db.ipRange.findMany({
    include: {
      _count: { select: { addresses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(ranges);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = ipRangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { label, gateway, startIp, endIp, individualIp } = parsed.data;
  const isIndividual = !!individualIp;

  // Determine addresses to create
  let addresses: string[];
  if (isIndividual) {
    addresses = [individualIp!];
  } else {
    addresses = expandRange(startIp!, endIp!);
  }

  const ipRange = await db.ipRange.create({
    data: {
      label,
      gateway,
      startIp: startIp ?? null,
      endIp: endIp ?? null,
      isIndividual,
      addresses: {
        create: addresses.map((address) => ({ address, gateway })),
      },
    },
    include: { _count: { select: { addresses: true } } },
  });

  return NextResponse.json(ipRange, { status: 201 });
}
