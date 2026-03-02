"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, UserPlus, Users, Search, UserMinus } from "lucide-react";
import { GroupDockerCompatibilityPermission } from "./group-docker-compatibility";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isAdmin: z.boolean(),
  maxRamMb: z.coerce.number().int().min(128),
  maxCpuCores: z.coerce.number().int().min(1),
  maxDiskGb: z.coerce.number().int().min(1),
  maxInstances: z.coerce.number().int().min(1),
  maxSwapMb: z.coerce.number().int().min(0),
});

type FormData = z.infer<typeof schema>;

interface Group {
  id: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  maxRamMb: number;
  maxCpuCores: number;
  maxDiskGb: number;
  maxInstances: number;
  maxSwapMb: number;
  allowDockerCompatibility: boolean;
  _count: { members: number; instances: number };
}

interface UserEntry {
  id: string;
  name: string | null;
  email: string | null;
  groups: { group: { id: string; name: string } }[];
}

export function AdminGroupsClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addMembersGroup, setAddMembersGroup] = useState<Group | null>(null);
  const [manageMembersGroup, setManageMembersGroup] = useState<Group | null>(null);
  const [addSearch, setAddSearch] = useState("");
  const [manageSearch, setManageSearch] = useState("");
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(new Set());
  const [groupSearch, setGroupSearch] = useState("");

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["admin-groups"],
    queryFn: () => fetch("/api/admin/groups").then((r) => r.json()),
  });

  const { data: users = [] } = useQuery<UserEntry[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then((r) => r.json()),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      name: "",
      description: "",
      isAdmin: false,
      maxRamMb: 512,
      maxCpuCores: 1,
      maxDiskGb: 8,
      maxInstances: 1,
      maxSwapMb: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      toast.success("Group created");
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      setOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Group deleted");
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
    },
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
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
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
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
    },
  });

  async function kickAll(groupId: string, memberIds: string[]) {
    await Promise.all(memberIds.map((userId) => removeMember.mutateAsync({ groupId, userId })));
    toast.success("All members removed");
    setManageMembersGroup(null);
  }

  async function removeSelected(groupId: string) {
    await Promise.all(
      [...selectedToRemove].map((userId) => removeMember.mutateAsync({ groupId, userId }))
    );
    toast.success(`${selectedToRemove.size} member(s) removed`);
    setSelectedToRemove(new Set());
  }

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  const filteredGroups = groups.filter((g) => {
    const q = groupSearch.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      (g.description ?? "").toLowerCase().includes(q)
    );
  });

  // Derived data for dialogs
  const addGroupMembers = addMembersGroup
    ? users.filter((u) => u.groups.some((g) => g.group.id === addMembersGroup.id)).map((u) => u.id)
    : [];

  const addFilteredUsers = users.filter((u) => {
    const q = addSearch.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const manageMembers = manageMembersGroup
    ? users.filter((u) => u.groups.some((g) => g.group.id === manageMembersGroup.id))
    : [];

  const manageFilteredMembers = manageMembers.filter((u) => {
    const q = manageSearch.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Group</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
                className="space-y-3"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["maxRamMb", "Max RAM (MB)", 128],
                      ["maxCpuCores", "Max CPU", 1],
                      ["maxDiskGb", "Max Disk (GB)", 1],
                      ["maxInstances", "Max Instances", 1],
                      ["maxSwapMb", "Max Swap (MB), 0=none", 0],
                    ] as const
                  ).map(([name, label, min]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input type="number" min={min} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    {...form.register("isAdmin")}
                  />
                  <label htmlFor="isAdmin" className="text-sm">
                    Admin group
                  </label>
                </div>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  Create
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search groups…"
          value={groupSearch}
          onChange={(e) => setGroupSearch(e.target.value)}
          className="w-full pl-8 pr-3 h-9 rounded-md border border-input bg-transparent text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Limits</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Instances</TableHead>
              <TableHead>Docker</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">
                  {g.name}
                  {g.isAdmin && (
                    <Badge className="ml-2" variant="secondary">
                      admin
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {g.maxRamMb}MB RAM · {g.maxCpuCores}CPU · {g.maxDiskGb}GB ·{" "}
                  {g.maxInstances}× · {g.maxSwapMb > 0 ? `${g.maxSwapMb}MB swap` : "no swap"}
                </TableCell>
                <TableCell>{g._count.members}</TableCell>
                <TableCell>{g._count.instances}</TableCell>
                <TableCell>
                  <GroupDockerCompatibilityPermission
                    groupId={g.id}
                    groupName={g.name}
                    allowDockerCompatibility={g.allowDockerCompatibility}
                    onSuccess={() => qc.invalidateQueries({ queryKey: ["admin-groups"] })}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {/* Add members */}
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Add members"
                      onClick={() => {
                        setAddSearch("");
                        setAddMembersGroup(g);
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    {/* Manage members */}
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Manage members"
                      onClick={() => {
                        setManageSearch("");
                        setSelectedToRemove(new Set());
                        setManageMembersGroup(g);
                      }}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    {/* Delete group */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(g.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredGroups.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  {groupSearch ? "No groups match your search." : "No groups yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Add members dialog ── */}
      <Dialog open={!!addMembersGroup} onOpenChange={(o) => !o && setAddMembersGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add members — {addMembersGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search users..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-9 rounded-md border border-input bg-transparent text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div className="max-h-80 overflow-y-auto divide-y">
            {addFilteredUsers.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No users found</p>
            )}
            {addFilteredUsers.map((u) => {
              const already = addMembersGroup ? addGroupMembers.includes(u.id) : false;
              return (
                <div
                  key={u.id}
                  className={`flex items-center justify-between py-2 px-1 ${already ? "opacity-50" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium">{u.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {already ? (
                    <Badge variant="secondary" className="text-xs">Already in group</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addMember.isPending}
                      onClick={() =>
                        addMembersGroup &&
                        addMember.mutate({ groupId: addMembersGroup.id, userId: u.id })
                      }
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Manage members dialog ── */}
      <Dialog open={!!manageMembersGroup} onOpenChange={(o) => !o && setManageMembersGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Members — {manageMembersGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search members..."
              value={manageSearch}
              onChange={(e) => setManageSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-9 rounded-md border border-input bg-transparent text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y">
            {manageMembers.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No members in this group</p>
            )}
            {manageFilteredMembers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2 px-1">
                <Checkbox
                  checked={selectedToRemove.has(u.id)}
                  onCheckedChange={(checked) => {
                    setSelectedToRemove((prev) => {
                      const next = new Set(prev);
                      checked ? next.add(u.id) : next.delete(u.id);
                      return next;
                    });
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removeMember.isPending}
                  onClick={() =>
                    manageMembersGroup &&
                    removeMember.mutate({ groupId: manageMembersGroup.id, userId: u.id })
                  }
                >
                  <UserMinus className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          {manageMembers.length > 0 && (
            <div className="flex gap-2 pt-1 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={selectedToRemove.size === 0 || removeMember.isPending}
                onClick={() =>
                  manageMembersGroup && removeSelected(manageMembersGroup.id)
                }
              >
                <UserMinus className="h-3.5 w-3.5 mr-1" />
                Remove selected ({selectedToRemove.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={removeMember.isPending}
                onClick={() =>
                  manageMembersGroup &&
                  kickAll(manageMembersGroup.id, manageMembers.map((u) => u.id))
                }
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Kick all
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
