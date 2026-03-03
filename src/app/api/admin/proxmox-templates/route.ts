import { NextResponse } from "next/server";
import { isAxiosError } from "axios";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";

export async function GET() {
  if (!(await requireAdmin())) {
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

    if (isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 500 || status === 404) {
        const node = process.env.PROXMOX_NODE ?? "pve";
        return NextResponse.json(
          {
            error: `Le nœud Proxmox "${node}" est introuvable. Vérifiez la variable d'environnement PROXMOX_NODE.`,
            code: "INVALID_NODE",
          },
          { status: 502 }
        );
      }
      if (!err.response) {
        return NextResponse.json(
          {
            error: "Impossible de joindre l'API Proxmox. Vérifiez PROXMOX_HOST et la connectivité réseau.",
            code: "UNREACHABLE",
          },
          { status: 502 }
        );
      }
      return NextResponse.json(
        {
          error: `Erreur Proxmox : ${err.response.status} ${err.response.statusText}`,
          code: "PROXMOX_ERROR",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Erreur interne du serveur.", code: "UNKNOWN" },
      { status: 500 }
    );
  }
}
