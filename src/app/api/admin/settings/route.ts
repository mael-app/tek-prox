import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

const updateSchema = z.object({
  storage: z.string().min(1),
  bridge: z.string().min(1),
});

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global", storage: "local-lvm", bridge: "vmbr0" },
    update: {},
  });

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global", ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json(settings);
}
