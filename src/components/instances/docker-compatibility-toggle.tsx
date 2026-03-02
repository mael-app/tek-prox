"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [pendingValue, setPendingValue] = useState(enabled);
  const router = useRouter();

  const isRunning = instanceStatus === "running";

  const mutation = useMutation({
    mutationFn: async (newEnabled: boolean) => {
      const response = await axios.post(`/api/instances/${vmid}/docker-compatibility`, {
        enabled: newEnabled,
      });
      return response.data;
    },
    onSuccess: (data) => {
      const action = !enabled ? "enabled" : "disabled";
      let message = `Docker compatibility ${action}.`;

      if (data.wasRestarted) {
        message += " Instance was restarted.";
      } else {
        message += " Configuration applied.";
      }

      toast.success(message);
      setOpen(false);
      router.refresh();
    },
    onError: (error: any) => {
      setPendingValue(enabled); // Revert optimistic update
      toast.error(error.response?.data?.error || "Failed to toggle Docker compatibility");
    },
  });

  const handleToggle = () => {
    if (!allowedByGroup) return;

    const newValue = !enabled;
    setPendingValue(newValue);
    setOpen(true);
  };

  const handleConfirm = () => {
    mutation.mutate(pendingValue);
  };

  const handleCancel = () => {
    setPendingValue(enabled); // Revert
    setOpen(false);
  };

  if (!allowedByGroup) {
    return (
      <div className="flex items-center justify-between opacity-50">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Docker Compatibility</Label>
          <p className="text-xs text-muted-foreground">
            Not allowed by your group
          </p>
        </div>
        <div className="relative inline-block w-11 h-6">
          <input
            type="checkbox"
            disabled
            className="sr-only"
          />
          <div className="block bg-muted rounded-full h-6 w-11 cursor-not-allowed" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="docker-switch" className="text-sm font-medium cursor-pointer">
            Docker Compatibility
          </Label>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Enabled - privileged mode active" : "Disabled"}
          </p>
        </div>
        <button
          id="docker-switch"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={mutation.isPending}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full
            transition-colors focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
            ${enabled ? "bg-primary" : "bg-input"}
          `}
        >
          <span
            className={`
              ${enabled ? "translate-x-6" : "translate-x-1"}
              inline-block h-4 w-4 transform rounded-full bg-background
              transition-transform shadow-lg
            `}
          />
        </button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingValue ? "Enable" : "Disable"} Docker Compatibility
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRunning ? (
                <>
                  {pendingValue
                    ? "This will shut down your instance, enable Docker compatibility (privileged mode), and restart it. This may take a minute."
                    : "This will shut down your instance, disable Docker compatibility, and restart it. This may take a minute."}
                </>
              ) : (
                <>
                  {pendingValue
                    ? "This will enable Docker compatibility (privileged mode) on your instance. The configuration will be applied immediately since the instance is stopped."
                    : "This will disable Docker compatibility on your instance. The configuration will be applied immediately since the instance is stopped."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Processing..." : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

