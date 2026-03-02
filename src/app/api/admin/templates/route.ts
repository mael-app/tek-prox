import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1),
  template: z.string().min(1),
});

async function adminCheck() {
  const session = await requireSession();
  if (!session?.user.isAdmin) return null;
  return session;
}

export async function GET() {
  // Accessible to all authenticated users (needed for instance creation form)
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await db.osTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  if (!(await adminCheck())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // Support batch creation (array) or single object
  if (Array.isArray(body)) {
    const results = [];
    for (const item of body) {
      const parsed = createSchema.safeParse(item);
      if (!parsed.success) continue;
      try {
        const t = await db.osTemplate.create({ data: parsed.data });
        results.push(t);
      } catch {
        // Skip duplicates
      }
    }
    return NextResponse.json(results, { status: 201 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await db.osTemplate.create({ data: parsed.data });

  return NextResponse.json(template, { status: 201 });
}
