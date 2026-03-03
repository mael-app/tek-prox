import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().optional(),
  isAdmin: z.boolean().optional(),
  maxRamMb: z.number().int().min(128).optional(),
  maxCpuCores: z.number().int().min(1).optional(),
  maxDiskGb: z.number().int().min(1).optional(),
  maxInstances: z.number().int().min(1).optional(),
  maxSwapMb: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const group = await db.group.findUnique({
    where: { id },
    include: {
      members: { include: { user: true } },
      _count: { select: { instances: true } },
    },
  });

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(group);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await db.group.update({ where: { id }, data: parsed.data });

  audit(session.user, "GROUP_UPDATE", id, { name: group.name, changes: parsed.data });

  return NextResponse.json(group);
}

export const PATCH = PUT;

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const group = await db.group.findUnique({ where: { id }, select: { name: true } });
  await db.group.delete({ where: { id } });

  audit(session.user, "GROUP_DELETE", id, { name: group?.name });

  return NextResponse.json({ success: true });
}
