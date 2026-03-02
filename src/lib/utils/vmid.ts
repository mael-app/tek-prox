import { db } from "@/lib/db";

/**
 * Find the next available VMID within [LXC_VMID_MIN, LXC_VMID_MAX].
 */
export async function getNextVmid(): Promise<number> {
  const min = parseInt(process.env.LXC_VMID_MIN ?? "200", 10);
  const max = parseInt(process.env.LXC_VMID_MAX ?? "999", 10);

  const used = await db.instance.findMany({
    select: { vmid: true },
    where: { vmid: { gte: min, lte: max } },
    orderBy: { vmid: "asc" },
  });

  const usedSet = new Set(used.map((i) => i.vmid));
  for (let id = min; id <= max; id++) {
    if (!usedSet.has(id)) return id;
  }

  throw new Error("No available VMID in configured range");
}
