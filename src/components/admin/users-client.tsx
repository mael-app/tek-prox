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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { UserPlus, Search, Trash2, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

interface Group {
  id: string;
  name: string;
}

interface UserEntry {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  groups: { group: Group }[];
  _count: { instances: number };
}

function compactDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

function compactDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function fullDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function AdminUsersClient() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [assignUser, setAssignUser] = useState<UserEntry | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserEntry[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then((r) => r.json()),
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["admin-groups"],
    queryFn: () => fetch("/api/admin/groups").then((r) => r.json()),
  });

  const addMember = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
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
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
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

  const forceLogoutMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/users/${id}/force-logout`, { method: "POST" }).then(
        async (r) => {
          if (!r.ok) throw new Error((await r.json()).error);
          return id;
        }
      ),
    onSuccess: (id) => {
      if (id === session?.user.id) {
        signOut({ callbackUrl: "/login" });
      } else {
        toast.success("User will be disconnected on their next request");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/users/${id}`, { method: "DELETE" }).then(
            async (r) => {
              if (!r.ok) throw new Error((await r.json()).error);
            }
          )
        )
      ),
    onSuccess: (_, ids) => {
      toast.success(
        `${ids.length} user${ids.length > 1 ? "s" : ""} deleted`
      );
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setSelectedUsers(new Set());
      setDeleteTarget(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDeleteTarget(null);
    },
  });

  if (usersLoading) return <p className="text-muted-foreground">Loading...</p>;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const filteredIds = filtered.map((u) => u.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedUsers.has(id));

  function toggleSelectAll() {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-md border border-input bg-transparent text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        {selectedUsers.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTarget([...selectedUsers])}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete {selectedUsers.size} selected
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Instances</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.has(user.id)}
                    onCheckedChange={(checked) => {
                      setSelectedUsers((prev) => {
                        const next = new Set(prev);
                        checked ? next.add(user.id) : next.delete(user.id);
                        return next;
                      });
                    }}
                    aria-label={`Select ${user.name ?? user.email}`}
                  />
                </TableCell>
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
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger>{compactDate(user.createdAt)}</TooltipTrigger>
                    <TooltipContent>{fullDateTime(user.createdAt)}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {user.lastLoginAt ? (
                    <Tooltip>
                      <TooltipTrigger>{compactDateTime(user.lastLoginAt)}</TooltipTrigger>
                      <TooltipContent>{fullDateTime(user.lastLoginAt)}</TooltipContent>
                    </Tooltip>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          disabled={forceLogoutMutation.isPending}
                          onClick={() => forceLogoutMutation.mutate(user.id)}
                        >
                          <LogOut className="h-4 w-4 text-orange-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Force logout</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => setDeleteTarget([user.id])}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete user</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-8"
                >
                  No users yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assign to group dialog */}
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

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {deleteTarget?.length === 1
                ? "this user"
                : `${deleteTarget?.length} users`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.length === 1
                ? "This will permanently delete this user and all their group memberships. Users with active instances cannot be deleted."
                : `This will permanently delete ${deleteTarget?.length} users and all their group memberships. Users with active instances cannot be deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
