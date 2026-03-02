"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface DockerCompatibilityToggleProps {
  vmid: number;
  enabled: boolean;
  allowedByGroup: boolean;
  instanceStatus: string;
}

export function DockerCompatibilityToggle({
  vmid,
  enabled,
  allowedByGroup,
  instanceStatus,
}: DockerCompatibilityToggleProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async (newEnabled: boolean) => {
      await axios.post(`/api/instances/${vmid}/docker-compatibility`, {
        enabled: newEnabled,
      });
    },
    onSuccess: () => {
      toast.success(
        `Docker compatibility ${!enabled ? "enabled" : "disabled"}. Instance is restarting.`
      );
      setOpen(false);
      router.refresh();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to toggle Docker compatibility");
    },
  });

  if (!allowedByGroup) {
    return (
      <Button disabled variant="outline" size="sm">
        Docker compatibility (not allowed)
      </Button>
    );
  }

  if (instanceStatus !== "running") {
    return (
      <Button disabled variant="outline" size="sm">
        Docker compatibility (instance must be running)
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={enabled ? "default" : "outline"} size="sm">
          {enabled ? "✓ Docker enabled" : "Enable Docker compatibility"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {enabled ? "Disable" : "Enable"} Docker Compatibility
          </AlertDialogTitle>
          <AlertDialogDescription>
            {enabled
              ? "This will disable Docker compatibility. Your instance will be shut down, reconfigured, and restarted. This may take a minute."
              : "This will enable Docker compatibility mode. Your instance will be shut down, configured with privileged settings, and restarted. This may take a minute."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mutation.mutate(!enabled)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Processing..." : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

