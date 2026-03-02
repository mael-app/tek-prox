import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";

export async function GET() {
  const session = await requireSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const proxmox = getProxmoxClient();

    // Find storages that support vztmpl
    const storages = await proxmox.listStorages();
    const templateStorages = storages.filter((s) =>
      s.content.split(",").map((c) => c.trim()).includes("vztmpl")
    );

    // Collect all templates from those storages
    const allTemplates: { volid: string; name: string }[] = [];
    for (const storage of templateStorages) {
      try {
        const templates = await proxmox.listTemplates(storage.storage);
        for (const t of templates) {
          const filename = t.volid.split("/").pop() ?? t.volid;
          const name = filename.replace(/\.tar\.(gz|zst|xz)$/, "");
          allTemplates.push({ volid: t.volid, name });
        }
      } catch {
        // Skip storages that fail
      }
    }

    // Deduplicate by volid
    const seen = new Set<string>();
    const deduplicated = allTemplates.filter((t) => {
      if (seen.has(t.volid)) return false;
      seen.add(t.volid);
      return true;
    });

    // Exclude templates already in DB
    const existing = await db.osTemplate.findMany({ select: { template: true } });
    const existingSet = new Set(existing.map((e) => e.template));
    const available = deduplicated.filter((t) => !existingSet.has(t.volid));

    return NextResponse.json(available);
  } catch (err) {
    console.error("Failed to list Proxmox templates:", err);
    return NextResponse.json(
      { error: "Failed to connect to Proxmox" },
      { status: 502 }
    );
  }
}
