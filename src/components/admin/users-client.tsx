"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserPlus } from "lucide-react";

interface Group {
  id: string;
  name: string;
}

interface UserEntry {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  groups: { group: Group }[];
  _count: { instances: number };
}

export function AdminUsersClient() {
  const qc = useQueryClient();
  const [assignUser, setAssignUser] = useState<UserEntry | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  const { data: users = [], isLoading: usersLoading } = useQuery<UserEntry[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then((r) => r.json()),
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["admin-groups"],
    queryFn: () => fetch("/api/admin/groups").then((r) => r.json()),
  });

  const addMember = useMutation({
    mutationFn: ({
      groupId,
      userId,
    }: {
      groupId: string;
      userId: string;
    }) =>
      fetch(`/api/admin/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      toast.success("User added to group");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setAssignUser(null);
      setSelectedGroup("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: ({
      groupId,
      userId,
    }: {
      groupId: string;
      userId: string;
    }) =>
      fetch(`/api/admin/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      toast.success("User removed from group");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  if (usersLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Instances</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.groups.map(({ group }) => (
                      <Badge
                        key={group.id}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() =>
                          removeMember.mutate({
                            groupId: group.id,
                            userId: user.id,
                          })
                        }
                      >
                        {group.name} ×
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{user._count.instances}</TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => setAssignUser(user)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Assign to a group</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No users yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!assignUser}
        onOpenChange={(open) => !open && setAssignUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {assignUser?.name} to group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!selectedGroup || addMember.isPending}
              className="w-full"
              onClick={() =>
                assignUser &&
                addMember.mutate({
                  groupId: selectedGroup,
                  userId: assignUser.id,
                })
              }
            >
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
