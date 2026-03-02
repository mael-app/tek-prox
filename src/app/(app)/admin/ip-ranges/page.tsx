import { AdminIpRangesClient } from "@/components/admin/ip-ranges-client";

export default function AdminIpRangesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">IP Ranges</h1>
      <AdminIpRangesClient />
    </div>
  );
}
