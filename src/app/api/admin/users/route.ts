import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      lastLoginAt: true,
      groups: {
        include: { group: true },
      },
      _count: { select: { instances: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
