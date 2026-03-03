import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  emails: z.array(z.string()).min(1).max(500),
});

const emailSchema = z.string().email();

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: groupId } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { emails } = parsed.data;

  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const results: {
    email: string;
    status: "added" | "created_and_added" | "already_in_group" | "error";
  }[] = [];

  for (const raw of emails) {
    const email = raw.trim().toLowerCase();

    if (!emailSchema.safeParse(email).success) {
      results.push({ email, status: "error" });
      continue;
    }

    let user = await db.user.findUnique({ where: { email } });
    let created = false;

    if (!user) {
      user = await db.user.create({ data: { email } });
      created = true;
    }

    const existing = await db.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId } },
    });

    if (existing) {
      results.push({ email, status: "already_in_group" });
    } else {
      await db.groupMember.create({ data: { userId: user.id, groupId } });
      results.push({ email, status: created ? "created_and_added" : "added" });
    }
  }

  const added = results.filter((r) => r.status === "added" || r.status === "created_and_added").length;
  const created = results.filter((r) => r.status === "created_and_added").length;

  audit(session.user, "MEMBER_IMPORT", groupId, {
    groupName: group.name,
    total: emails.length,
    added,
    created,
    alreadyInGroup: results.filter((r) => r.status === "already_in_group").length,
    errors: results.filter((r) => r.status === "error").length,
  });

  return NextResponse.json({ results });
}
