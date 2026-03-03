import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const groupSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().optional(),
  isAdmin: z.boolean().default(false),
  maxRamMb: z.number().int().min(128).default(512),
  maxCpuCores: z.number().int().min(1).default(1),
  maxDiskGb: z.number().int().min(1).default(8),
  maxInstances: z.number().int().min(1).default(1),
  maxSwapMb: z.number().int().min(0).default(0),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groups = await db.group.findMany({
    include: {
      _count: { select: { members: true, instances: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = groupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await db.group.create({ data: parsed.data });

  audit(session.user, "GROUP_CREATE", group.id, { name: group.name });

  return NextResponse.json(group, { status: 201 });
}
