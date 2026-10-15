import { AdminIpRangesClient } from "@/components/admin/ip-ranges-client";
import { db } from "@/lib/db";

export default async function AdminIpRangesPage() {
  const settings = await db.settings.findUnique({ where: { id: "global" } });
  return <AdminIpRangesClient isDhcp={settings?.networkMode === "dhcp"} />;
}
