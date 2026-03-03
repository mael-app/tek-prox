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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil } from "lucide-react";

const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

const rangeSchema = z.object({
  label: z.string().optional(),
  gateway: z.string().regex(ipv4Regex, "Invalid IP"),
  startIp: z.string().regex(ipv4Regex, "Invalid IP"),
  endIp: z.string().regex(ipv4Regex, "Invalid IP"),
});

const singleSchema = z.object({
  label: z.string().optional(),
  gateway: z.string().regex(ipv4Regex, "Invalid IP"),
  individualIp: z.string().regex(ipv4Regex, "Invalid IP"),
});

type RangeFormData = z.infer<typeof rangeSchema>;
type SingleFormData = z.infer<typeof singleSchema>;

interface IpRange {
  id: string;
  label: string | null;
  gateway: string;
  startIp: string | null;
  endIp: string | null;
  isIndividual: boolean;
  _count: { addresses: number };
}

export function AdminIpRangesClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editRange, setEditRange] = useState<IpRange | null>(null);

  const { data: ranges = [], isLoading } = useQuery<IpRange[]>({
    queryKey: ["admin-ip-ranges"],
    queryFn: () => fetch("/api/admin/ip-ranges").then((r) => r.json()),
  });

  const rangeForm = useForm<RangeFormData>({
    resolver: zodResolver(rangeSchema),
    defaultValues: { label: "", gateway: "", startIp: "", endIp: "" },
  });

  const singleForm = useForm<SingleFormData>({
    resolver: zodResolver(singleSchema),
    defaultValues: { label: "", gateway: "", individualIp: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, string | undefined>) =>
      fetch("/api/admin/ip-ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: (data: IpRange) => {
      toast.success(`Created ${data._count.addresses} IP address(es)`);
      qc.invalidateQueries({ queryKey: ["admin-ip-ranges"] });
      setOpen(false);
      rangeForm.reset();
      singleForm.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string | undefined> }) =>
      fetch(`/api/admin/ip-ranges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      toast.success("IP range updated");
      qc.invalidateQueries({ queryKey: ["admin-ip-ranges"] });
      setEditRange(null);
      rangeForm.reset();
      singleForm.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/ip-ranges/${id}`, { method: "DELETE" }).then(
        async (r) => {
          if (!r.ok) throw new Error((await r.json()).error);
          return r.json();
        }
      ),
    onSuccess: () => {
      toast.success("IP range deleted");
      qc.invalidateQueries({ queryKey: ["admin-ip-ranges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add IP Range
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add IP Range</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="range">
              <TabsList className="w-full">
                <TabsTrigger value="range" className="flex-1">
                  Range
                </TabsTrigger>
                <TabsTrigger value="single" className="flex-1">
                  Single IP
                </TabsTrigger>
              </TabsList>

              <TabsContent value="range">
                <Form {...rangeForm}>
                  <form
                    onSubmit={rangeForm.handleSubmit((d) =>
                      createMutation.mutate(d)
                    )}
                    className="space-y-3 mt-2"
                  >
                    <FormField
                      control={rangeForm.control}
                      name="label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Label (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Production subnet" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={rangeForm.control}
                      name="gateway"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gateway</FormLabel>
                          <FormControl>
                            <Input placeholder="192.168.1.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={rangeForm.control}
                        name="startIp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start IP</FormLabel>
                            <FormControl>
                              <Input placeholder="192.168.1.100" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={rangeForm.control}
                        name="endIp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End IP</FormLabel>
                            <FormControl>
                              <Input placeholder="192.168.1.200" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createMutation.isPending}
                    >
                      Add Range
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="single">
                <Form {...singleForm}>
                  <form
                    onSubmit={singleForm.handleSubmit((d) =>
                      createMutation.mutate(d)
                    )}
                    className="space-y-3 mt-2"
                  >
                    <FormField
                      control={singleForm.control}
                      name="label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Label (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={singleForm.control}
                      name="gateway"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gateway</FormLabel>
                          <FormControl>
                            <Input placeholder="192.168.1.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={singleForm.control}
                      name="individualIp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IP Address</FormLabel>
                          <FormControl>
                            <Input placeholder="192.168.1.50" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createMutation.isPending}
                    >
                      Add IP
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Edit IP range dialog ── */}
      <Dialog open={!!editRange} onOpenChange={(o) => !o && setEditRange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit IP Range</DialogTitle>
          </DialogHeader>
          {editRange?.isIndividual ? (
            <Form {...singleForm}>
              <form
                onSubmit={singleForm.handleSubmit((d) =>
                  editRange && updateMutation.mutate({ id: editRange.id, data: d })
                )}
                className="space-y-3"
              >
                <FormField
                  control={singleForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={singleForm.control}
                  name="gateway"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gateway</FormLabel>
                      <FormControl>
                        <Input placeholder="192.168.1.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={singleForm.control}
                  name="individualIp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IP Address</FormLabel>
                      <FormControl>
                        <Input placeholder="192.168.1.50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateMutation.isPending}
                >
                  Update
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...rangeForm}>
              <form
                onSubmit={rangeForm.handleSubmit((d) =>
                  editRange && updateMutation.mutate({ id: editRange.id, data: d })
                )}
                className="space-y-3"
              >
                <FormField
                  control={rangeForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Production subnet" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={rangeForm.control}
                  name="gateway"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gateway</FormLabel>
                      <FormControl>
                        <Input placeholder="192.168.1.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={rangeForm.control}
                    name="startIp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start IP</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.1.100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={rangeForm.control}
                    name="endIp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End IP</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.1.200" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateMutation.isPending}
                >
                  Update
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Range</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Addresses</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranges.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.label ?? "—"}</TableCell>
                <TableCell className="font-mono text-sm">
                  {r.isIndividual
                    ? "single"
                    : `${r.startIp} – ${r.endIp}`}
                </TableCell>
                <TableCell className="font-mono text-sm">{r.gateway}</TableCell>
                <TableCell>{r._count.addresses}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Edit"
                      onClick={() => {
                        if (r.isIndividual) {
                          singleForm.reset({
                            label: r.label ?? "",
                            gateway: r.gateway,
                            individualIp: r.startIp ?? "",
                          });
                        } else {
                          rangeForm.reset({
                            label: r.label ?? "",
                            gateway: r.gateway,
                            startIp: r.startIp ?? "",
                            endIp: r.endIp ?? "",
                          });
                        }
                        setEditRange(r);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(r.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {ranges.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No IP ranges configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
