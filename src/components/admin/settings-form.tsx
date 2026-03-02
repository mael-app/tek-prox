"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
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
import { Loader2 } from "lucide-react";

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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))}
        className="space-y-4 max-w-md"
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
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Settings
        </Button>
      </form>
    </Form>
  );
}
