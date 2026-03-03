import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
  }

  const { id } = await params;
  const { allowDockerCompatibility } = await _req.json();

  try {
    const group = await db.group.update({
      where: { id },
      data: { allowDockerCompatibility },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("Update group error:", error);
    return NextResponse.json(
      { error: "Failed to update group" },
      { status: 500 }
    );
  }
}

