import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const memberSchema = z.object({ userId: z.string().min(1) });

async function adminCheck() {
  const session = await requireSession();
  if (!session?.user.isAdmin) return null;
  return session;
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await adminCheck())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: groupId } = await params;
  const body = await req.json();
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const member = await db.groupMember.create({
    data: { userId: parsed.data.userId, groupId },
    include: { user: true },
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await adminCheck())) {
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
