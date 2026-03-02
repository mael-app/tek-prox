import { isAxiosError } from "axios";
import { db } from "@/lib/db";
import { getProxmoxClient } from "@/lib/proxmox";

/**
 * Find the next available VMID within [LXC_VMID_MIN, LXC_VMID_MAX].
 * Uses Proxmox as source of truth: GET /cluster/nextid?vmid=X returns 200
 * if X is free, 400 if already taken. We iterate candidates skipping both
 * DB-tracked IDs and Proxmox-occupied ones.
 */
export async function getNextVmid(): Promise<number> {
  const min = parseInt(process.env.LXC_VMID_MIN ?? "200", 10);
  const max = parseInt(process.env.LXC_VMID_MAX ?? "999", 10);

  const used = await db.instance.findMany({
    select: { vmid: true },
    where: { vmid: { gte: min, lte: max } },
  });
  const usedInDb = new Set(used.map((i) => i.vmid));

  const proxmox = getProxmoxClient();

  for (let candidate = min; candidate <= max; candidate++) {
    if (usedInDb.has(candidate)) continue;

    try {
      // Returns 200 + the same ID if free, 400 if already taken in Proxmox
      await proxmox.getNextVmid({ hint: candidate });
      return candidate;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) {
        // This VMID is occupied in Proxmox, try the next one
        continue;
      }
      throw err;
    }
  }

  throw new Error("No available VMID in configured range");
}
