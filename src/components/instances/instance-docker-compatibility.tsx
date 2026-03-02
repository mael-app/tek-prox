"use client";

import { DockerCompatibilityToggle } from "./docker-compatibility-toggle";

interface InstanceDockerCompatibilityProps {
  vmid: number;
  dockerCompatibilityEnabled: boolean;
  allowDockerCompatibility: boolean;
  status: string;
}

export function InstanceDockerCompatibility({
  vmid,
  dockerCompatibilityEnabled,
  allowDockerCompatibility,
  status,
}: InstanceDockerCompatibilityProps) {
  if (!allowDockerCompatibility) {
    return (
      <div className="text-sm text-muted-foreground">
        Your group does not have permission to enable Docker compatibility.
        Contact an administrator to request this permission.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Docker compatibility mode enables privileged container features required
        to run Docker and similar containerization tools inside your LXC instance.
      </div>
      <DockerCompatibilityToggle
        vmid={vmid}
        enabled={dockerCompatibilityEnabled}
        allowedByGroup={allowDockerCompatibility}
        instanceStatus={status}
      />
    </div>
  );
}

