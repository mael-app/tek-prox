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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Download, Loader2 } from "lucide-react";

interface OsTemplate {
  id: string;
  name: string;
  template: string;
  createdAt: string;
}

interface ProxmoxTemplate {
  volid: string;
  name: string;
}

const addSchema = z.object({
  name: z.string().min(1),
  template: z.string().min(1),
});

type AddFormData = z.infer<typeof addSchema>;

export function TemplatesClient() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedVolids, setSelectedVolids] = useState<Set<string>>(new Set());

  const { data: templates = [], isLoading } = useQuery<OsTemplate[]>({
    queryKey: ["admin-templates"],
    queryFn: () => fetch("/api/admin/templates").then((r) => r.json()),
  });

  const {
    data: proxmoxTemplates = [],
    isFetching: isLoadingProxmox,
    isError: isProxmoxError,
    error: proxmoxError,
    refetch: fetchProxmox,
  } = useQuery<ProxmoxTemplate[], Error>({
    queryKey: ["proxmox-templates"],
    queryFn: async () => {
      const r = await fetch("/api/admin/proxmox-templates");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Erreur lors de la récupération des templates Proxmox.");
      }
      return r.json();
    },
    enabled: false,
    retry: false,
  });

  const form = useForm<AddFormData>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: "", template: "" },
  });

  const addMutation = useMutation({
    mutationFn: (data: AddFormData) =>
      fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      toast.success("Template added");
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      setAddOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMutation = useMutation({
    mutationFn: (items: { name: string; template: string }[]) =>
      fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: (data: OsTemplate[]) => {
      toast.success(`Imported ${data.length} template(s)`);
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      qc.invalidateQueries({ queryKey: ["proxmox-templates"] });
      setImportOpen(false);
      setSelectedVolids(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
    },
  });

  function openImport() {
    setImportOpen(true);
    fetchProxmox();
  }

  function toggleVolid(volid: string) {
    setSelectedVolids((prev) => {
      const next = new Set(prev);
      if (next.has(volid)) next.delete(volid);
      else next.add(volid);
      return next;
    });
  }

  function handleImport() {
    const items = proxmoxTemplates
      .filter((t) => selectedVolids.has(t.volid))
      .map((t) => ({ name: t.name, template: t.volid }));
    if (items.length === 0) return;
    importMutation.mutate(items);
  }

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 mb-4">
        <Button variant="outline" onClick={openImport}>
          <Download className="h-4 w-4 mr-2" />
          Import from Proxmox
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Manually
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add OS Template</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) => addMutation.mutate(d))}
                className="space-y-3"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Debian 12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="template"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Path</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="local:vztmpl/debian-12-standard.tar.zst"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="w-full"
                >
                  {addMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Template
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import from Proxmox</DialogTitle>
          </DialogHeader>
          {isLoadingProxmox ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Scanning Proxmox storages...
              </span>
            </div>
          ) : isProxmoxError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p className="font-semibold mb-1">Impossible de récupérer les templates</p>
              <p className="text-xs leading-relaxed">{proxmoxError?.message}</p>
              <button
                onClick={() => fetchProxmox()}
                className="mt-2 text-xs underline underline-offset-2 hover:opacity-75"
              >
                Réessayer
              </button>
            </div>
          ) : proxmoxTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No new templates found on Proxmox.
            </p>
          ) : (
            <>
              <div className="space-y-2 max-h-72 overflow-y-auto py-2">
                {proxmoxTemplates.map((t) => (
                  <div key={t.volid} className="flex items-center gap-3">
                    <Checkbox
                      id={t.volid}
                      checked={selectedVolids.has(t.volid)}
                      onCheckedChange={() => toggleVolid(t.volid)}
                    />
                    <label htmlFor={t.volid} className="text-sm cursor-pointer">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {t.volid}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedVolids.size === 0 || importMutation.isPending}
                >
                  {importMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Selected ({selectedVolids.size})
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Template Path</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">
                  {t.template}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(t.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground py-8"
                >
                  No templates yet. Add one manually or import from Proxmox.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
