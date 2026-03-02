import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { TemplatesClient } from "@/components/admin/templates-client";

export default async function AdminTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">OS Templates</h1>
      <p className="text-muted-foreground mb-6">
        Manage the OS templates available when creating new instances.
      </p>
      <TemplatesClient />
    </div>
  );
}
