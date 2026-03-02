import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const SSH_KEY_PATTERN =
  /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) ([A-Za-z0-9+/]{20,}={0,3})( .+)?$/;

const sshKeySchema = z.object({
  sshPublicKey: z
    .string()
    .min(1)
    .max(4096, "SSH public key is too long")
    .refine((key) => SSH_KEY_PATTERN.test(key.trim()), {
      message: "Invalid SSH public key format",
    }),
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
