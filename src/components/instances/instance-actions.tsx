"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Play, Square, Key, Trash2, Loader2 } from "lucide-react";

interface Props {
  vmid: number;
  status: string;
  userHasSshKey?: boolean;
}

export function InstanceActions({ vmid, status, userHasSshKey = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function action(type: string) {
    setLoading(type);
    try {
      let url = "";
      let method = "POST";

      if (type === "start") url = `/api/instances/${vmid}/start`;
      else if (type === "stop") url = `/api/instances/${vmid}/stop`;
      else if (type === "ssh") url = `/api/instances/${vmid}/activate-ssh`;
      else if (type === "delete") {
        url = `/api/instances/${vmid}`;
        method = "DELETE";
      }

      const res = await fetch(url, { method });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Action failed");
        return;
      }

      if (type === "delete") {
        toast.success("Instance deleted");
        router.push("/instances");
        router.refresh();
      } else {
        toast.success(
          type === "start"
            ? "Instance started"
            : type === "stop"
              ? "Instance stopped"
              : "SSH key injected"
        );
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  const isRunning = status === "running";
  const isStopped = status === "stopped";
  const canActivateSsh = isRunning && userHasSshKey;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={!!loading || isRunning}
        onClick={() => action("start")}
      >
        {loading === "start" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        Start
      </Button>

      <Button
        variant="outline"
        disabled={!!loading || isStopped}
        onClick={() => action("stop")}
      >
        {loading === "stop" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Square className="h-4 w-4 mr-2" />
        )}
        Stop
      </Button>

      <Button
        variant="outline"
        disabled={!!loading || !canActivateSsh}
        onClick={() => action("ssh")}
        title={
          !userHasSshKey
            ? "No SSH key configured. Go to Settings to add one."
            : !isRunning
              ? "Instance must be running"
              : "Inject your SSH key into the instance"
        }
      >
        {loading === "ssh" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Key className="h-4 w-4 mr-2" />
        )}
        Activate SSH Key
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={!!loading}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete instance?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently destroy the LXC container and release its IP
              address. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => action("delete")}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
