import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const memberSchema = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: groupId } = await params;
  const body = await req.json();
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId } = parsed.data;

  // Check if member already exists
  const existing = await db.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "User is already a member of this group" },
      { status: 409 }
    );
  }

  const member = await db.groupMember.create({
    data: { userId, groupId },
    include: { user: true },
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: groupId } = await params;
  const body = await req.json();
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await db.groupMember.deleteMany({
    where: { userId: parsed.data.userId, groupId },
  });

  return NextResponse.json({ success: true });
}
