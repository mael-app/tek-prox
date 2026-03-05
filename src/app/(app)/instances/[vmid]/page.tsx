import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InstanceActions } from "@/components/instances/instance-actions";
import { InstanceDockerCompatibility } from "@/components/instances/instance-docker-compatibility";
import { InstanceResourceEditor } from "@/components/instances/instance-resource-editor";
import { CopyableValue } from "@/components/ui/copy-button";

type Params = { params: Promise<{ vmid: string }> };

export default async function InstanceDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);

  const instance = await db.instance.findUnique({
    where: { vmid },
    include: { ip: true, group: true, user: true },
  });

  if (!instance) notFound();

  if (instance.userId !== session.user.id && !session.user.isAdmin) {
    redirect("/instances");
  }

  const userHasSshKey = !!instance.user.sshPublicKey;

  const details = [
    { label: "VMID", value: instance.vmid },
    { label: "Hostname", value: instance.name },
    { label: "Status", value: instance.status },
    { label: "IP Address", value: instance.ip?.address ?? "—", copyValue: instance.ip?.address ?? null },
    { label: "Gateway", value: instance.ip?.gateway ?? "—", copyValue: instance.ip?.gateway ?? null },
    { label: "OS Template", value: instance.osTemplate },
    { label: "RAM", value: `${instance.ramMb} MB` },
    { label: "CPU Cores", value: instance.cpuCores },
    { label: "Disk", value: `${instance.diskGb} GB` },
    { label: "Swap", value: `${instance.swapMb} MB` },
    { label: "Node", value: instance.node },
    {
      label: "Created",
      value: new Date(instance.createdAt).toLocaleString(),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{instance.name}</h1>
        <Badge
          variant="outline"
          className={
            instance.status === "running"
              ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
              : instance.status === "stopped"
                ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                : "bg-muted text-muted-foreground"
          }
        >
          {instance.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — interactive cards */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <InstanceActions
                vmid={vmid}
                status={instance.status}
                userHasSshKey={userHasSshKey}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Docker Compatibility</CardTitle>
            </CardHeader>
            <CardContent>
              <InstanceDockerCompatibility
                vmid={vmid}
                dockerCompatibilityEnabled={instance.dockerCompatibilityEnabled}
                allowDockerCompatibility={instance.group.allowDockerCompatibility}
                status={instance.status}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <InstanceResourceEditor
                vmid={vmid}
                current={{
                  ramMb: instance.ramMb,
                  cpuCores: instance.cpuCores,
                  diskGb: instance.diskGb,
                  swapMb: instance.swapMb,
                }}
                group={{
                  maxRamMb: instance.group.maxRamMb,
                  maxCpuCores: instance.group.maxCpuCores,
                  maxDiskGb: instance.group.maxDiskGb,
                  maxSwapMb: instance.group.maxSwapMb,
                }}
                isAdmin={session.user.isAdmin}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column — details sidebar */}
        <div className="lg:col-span-1 flex flex-col">
          <Card className="lg:sticky lg:top-6 flex-1">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3">
                {details.map(({ label, value, copyValue }) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                      {label}
                    </dt>
                    <dd className="flex items-center font-medium font-mono text-sm mt-0.5">
                      {copyValue ? (
                        <CopyableValue value={copyValue} label={`Copy ${label}`} />
                      ) : (
                        String(value)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
