import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { GroupStatsPagination } from "@/components/dashboard/group-stats-pagination";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  // Admins see all groups; regular users only see their own memberships
  const memberships = session.user.isAdmin
    ? await db.group.findMany({
        include: { instances: { where: { userId: session.user.id } } },
        orderBy: { name: "asc" },
      })
    : await db.groupMember
        .findMany({
          where: { userId: session.user.id },
          include: {
            group: { include: { instances: { where: { userId: session.user.id } } } },
          },
          orderBy: { group: { name: "asc" } },
        })
        .then((ms) => ms.map((m) => m.group));

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {session.user.name}</p>
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You are not assigned to a group yet. Contact an admin.
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 min-h-0">
          <GroupStatsPagination groups={memberships} />
        </div>
      )}
    </div>
  );
}
