import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateInstanceForm } from "@/components/instances/create-instance-form";

export default async function NewInstancePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const groupMember = await db.groupMember.findFirst({
    where: { userId: session.user.id },
    include: { group: true },
  });

  if (!groupMember) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">New Instance</h1>
        <p className="text-muted-foreground">
          You are not assigned to a group. Contact an admin.
        </p>
      </div>
    );
  }

  const { group } = groupMember;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Instance</h1>

      <Card>
        <CardHeader>
          <CardTitle>Instance Configuration</CardTitle>
          <p className="text-sm text-muted-foreground">
            Limits: {group.maxRamMb} MB RAM · {group.maxCpuCores} CPU ·{" "}
            {group.maxDiskGb} GB disk · {group.maxInstances} instance(s) total
            {group.maxSwapMb > 0 ? ` · ${group.maxSwapMb} MB swap` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <CreateInstanceForm
            maxRamMb={group.maxRamMb}
            maxCpuCores={group.maxCpuCores}
            maxDiskGb={group.maxDiskGb}
            maxSwapMb={group.maxSwapMb}
          />
        </CardContent>
      </Card>
    </div>
  );
}
