import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface GroupDockerCompatibilityProps {
  groupId: string;
  groupName: string;
  allowDockerCompatibility: boolean;
  onSuccess?: () => void;
}

export function GroupDockerCompatibilityPermission({
  groupId,
  groupName,
  allowDockerCompatibility,
  onSuccess,
}: GroupDockerCompatibilityProps) {
  const [checked, setChecked] = useState(allowDockerCompatibility);

  const mutation = useMutation({
    mutationFn: async (allow: boolean) => {
      await axios.patch(
        `/api/admin/groups/${groupId}/docker-compatibility`,
        { allowDockerCompatibility: allow }
      );
    },
    onSuccess: () => {
      toast.success("Permission updated");
      onSuccess?.();
    },
    onError: (error: any) => {
      setChecked(!checked); // Revert on error
      toast.error(error.response?.data?.error || "Failed to update permission");
    },
  });

  const handleChange = (newChecked: boolean) => {
    setChecked(newChecked);
    mutation.mutate(newChecked);
  };

  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`docker-${groupId}`}
        checked={checked}
        onCheckedChange={handleChange}
        disabled={mutation.isPending}
      />
      <Label htmlFor={`docker-${groupId}`} className="cursor-pointer">
        Allow Docker compatibility for {groupName}
      </Label>
    </div>
  );
}

