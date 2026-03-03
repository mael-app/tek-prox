import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { Button } from "@/components/ui/button";
import { InstanceList } from "@/components/instances/instance-list";
import { Plus } from "lucide-react";

export default async function InstancesPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.isAdmin ?? false;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Instances</h1>
        <Button asChild>
          <Link href="/instances/new">
            <Plus className="h-4 w-4 mr-2" />
            New Instance
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <InstanceList isAdmin={isAdmin} />
      </div>
    </div>
  );
}
