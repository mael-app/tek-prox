import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Cpu, MemoryStick, HardDrive } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const groupMember = await db.groupMember.findFirst({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          instances: { where: { userId: session.user.id } },
        },
      },
    },
  });

  const group = groupMember?.group;
  const instances = group?.instances ?? [];

  const usedRam = instances.reduce((s, i) => s + i.ramMb, 0);
  const usedCpu = instances.reduce((s, i) => s + i.cpuCores, 0);
  const usedDisk = instances.reduce((s, i) => s + i.diskGb, 0);

  const stats = [
    {
      label: "Instances",
      used: instances.length,
      max: group?.maxInstances ?? 0,
      icon: Server,
      unit: "",
    },
    {
      label: "RAM",
      used: usedRam,
      max: group?.maxRamMb ?? 0,
      icon: MemoryStick,
      unit: " MB",
    },
    {
      label: "CPU Cores",
      used: usedCpu,
      max: group?.maxCpuCores ?? 0,
      icon: Cpu,
      unit: "",
    },
    {
      label: "Disk",
      used: usedDisk,
      max: group?.maxDiskGb ?? 0,
      icon: HardDrive,
      unit: " GB",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name}
        </p>
      </div>

      {!group ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You are not assigned to a group yet. Contact an admin.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm text-muted-foreground">Group:</p>
            <Badge variant="secondary">{group.name}</Badge>
            {group.isAdmin && <Badge>Admin</Badge>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(({ label, used, max, icon: Icon, unit }) => {
              const pct = max > 0 ? Math.round((used / max) * 100) : 0;
              return (
                <Card key={label}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {used}
                      {unit}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}/ {max}
                        {unit}
                      </span>
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{pct}% used</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
