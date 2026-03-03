"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, X, TriangleAlert } from "lucide-react";

const schema = z.object({
  storage: z.string().min(1),
  bridge: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

interface Settings {
  id: string;
  storage: string;
  bridge: string;
  updatedAt: string;
}

export function SettingsForm() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["admin-settings"],
    queryFn: () => fetch("/api/admin/settings").then((r) => r.json()),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { storage: "local-lvm", bridge: "vmbr0" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({ storage: settings.storage, bridge: settings.bridge });
    }
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (data: FormData) =>
      fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCancel() {
    if (settings) form.reset({ storage: settings.storage, bridge: settings.bridge });
    setEditing(false);
  }

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      {/* ── Read-only display ── */}
      {!editing && settings && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Current configuration</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
                className="shrink-0 text-muted-foreground"
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Storage</dt>
                <dd className="font-mono font-medium mt-0.5">{settings.storage}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Network Bridge</dt>
                <dd className="font-mono font-medium mt-0.5">{settings.bridge}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* ── Edit form ── */}
      {editing && (
        <div className="space-y-4">
          {/* Warning banner */}
          <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3 text-destructive">
            <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Dangerous operation — proceed with caution</p>
              <p className="text-destructive/80">
                Changing the storage pool or network bridge affects all future instance
                deployments. Incorrect values will cause instance creation to fail on
                Proxmox. Make sure the target storage and bridge exist on your node
                before saving.
              </p>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="storage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage</FormLabel>
                    <FormControl>
                      <Input placeholder="local-lvm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bridge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network Bridge</FormLabel>
                    <FormControl>
                      <Input placeholder="vmbr0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Settings
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saveMutation.isPending}
                  onClick={handleCancel}
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}

