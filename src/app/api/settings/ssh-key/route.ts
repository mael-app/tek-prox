import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const sshKeySchema = z.object({
  sshPublicKey: z
    .string()
    .min(1)
    .refine(
      (key) =>
        key.startsWith("ssh-rsa ") ||
        key.startsWith("ssh-ed25519 ") ||
        key.startsWith("ecdsa-sha2-nistp") ||
        key.startsWith("sk-"),
      { message: "Invalid SSH public key format" }
    ),
});

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { sshPublicKey: true },
  });

  return NextResponse.json({ sshPublicKey: user?.sshPublicKey ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = sshKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { sshPublicKey: parsed.data.sshPublicKey.trim() },
  });

  return NextResponse.json({ success: true });
}
