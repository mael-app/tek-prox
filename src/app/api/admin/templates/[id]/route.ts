import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function adminCheck() {
  const session = await requireSession();
  if (!session?.user.isAdmin) return null;
  return session;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await adminCheck())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await db.osTemplate.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
