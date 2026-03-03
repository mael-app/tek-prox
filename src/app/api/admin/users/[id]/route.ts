import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id },
    include: { _count: { select: { instances: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user._count.instances > 0) {
    return NextResponse.json(
      {
        error: `This user has ${user._count.instances} active instance${user._count.instances > 1 ? "s" : ""}. Please delete them first.`,
      },
      { status: 409 }
    );
  }

  await db.user.delete({ where: { id } });

  audit(session.user, "USER_DELETE", id, { email: user.email, name: user.name });

  return NextResponse.json({ success: true });
}
