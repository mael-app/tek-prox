import { AdminUsersClient } from "@/components/admin/users-client";

export default function AdminUsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      <AdminUsersClient />
    </div>
  );
}
