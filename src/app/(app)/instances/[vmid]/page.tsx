import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InstanceActions } from "@/components/instances/instance-actions";
import { InstanceDockerCompatibility } from "@/components/instances/instance-docker-compatibility";

type Params = { params: Promise<{ vmid: string }> };

export default async function InstanceDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

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
    { label: "IP Address", value: instance.ip?.address ?? "—" },
    { label: "Gateway", value: instance.ip?.gateway ?? "—" },
    { label: "OS Template", value: instance.osTemplate },
    { label: "RAM", value: `${instance.ramMb} MB` },
    { label: "CPU Cores", value: instance.cpuCores },
    { label: "Disk", value: `${instance.diskGb} GB` },
    { label: "Node", value: instance.node },
    {
      label: "Created",
      value: new Date(instance.createdAt).toLocaleString(),
    },
  ];

  return (
    <div className="max-w-2xl">
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

      <Card className="mb-6">
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

      <Card className="mb-6">
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
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {details.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                  {label}
                </dt>
                <dd className="font-medium font-mono text-sm mt-0.5">
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
