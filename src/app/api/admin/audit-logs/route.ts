import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const action = searchParams.get("action") ?? undefined;
  const search = searchParams.get("search")?.trim() ?? undefined;

  const where = {
    ...(action ? { action } : {}),
    ...(search
      ? {
          OR: [
            { userEmail: { contains: search } },
            { userId: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
