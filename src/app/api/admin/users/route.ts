import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      groups: {
        include: { group: true },
      },
      _count: { select: { instances: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
