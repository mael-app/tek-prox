import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateInstanceForm } from "@/components/instances/create-instance-form";

export default async function NewInstancePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Admins see all groups; regular users only see their own memberships
  const groups = session.user.isAdmin
    ? await db.group.findMany({ orderBy: { name: "asc" } })
    : await db.groupMember
        .findMany({
          where: { userId: session.user.id },
          include: { group: true },
          orderBy: { group: { name: "asc" } },
        })
        .then((ms) => ms.map((m) => m.group));

  if (groups.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">New Instance</h1>
        <p className="text-muted-foreground">
          You are not assigned to a group. Contact an admin.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Instance</h1>
      <Card>
        <CardHeader>
          <CardTitle>Instance Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateInstanceForm groups={groups} />
        </CardContent>
      </Card>
    </div>
  );
}
