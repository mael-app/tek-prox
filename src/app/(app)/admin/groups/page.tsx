import { AdminGroupsClient } from "@/components/admin/groups-client";

export default function AdminGroupsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Groups</h1>
      <AdminGroupsClient />
    </div>
  );
}
