"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Plus, Trash2 } from "lucide-react";
import { GroupDockerCompatibilityPermission } from "./group-docker-compatibility";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isAdmin: z.boolean(),
  maxRamMb: z.number().int().min(128),
  maxCpuCores: z.number().int().min(1),
  maxDiskGb: z.number().int().min(1),
  maxInstances: z.number().int().min(1),
  maxSwapMb: z.number().int().min(0),
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

export function AdminGroupsClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["admin-groups"],
    queryFn: () => fetch("/api/admin/groups").then((r) => r.json()),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
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

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

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
            {groups.map((g) => (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(g.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {groups.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No groups yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
