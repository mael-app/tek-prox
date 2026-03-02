"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface OsTemplate {
  id: string;
  name: string;
  template: string;
}

interface Group {
  id: string;
  name: string;
  maxRamMb: number;
  maxCpuCores: number;
  maxDiskGb: number;
  maxSwapMb: number;
  maxInstances: number;
}

const schema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, {
    message: "Only lowercase letters, digits, and hyphens",
  }),
  groupId: z.string().min(1, "Please select a group"),
  ramMb: z.coerce.number().int().min(128),
  cpuCores: z.coerce.number().int().min(1),
  diskGb: z.coerce.number().int().min(1),
  swapMb: z.coerce.number().int().min(0),
  osTemplate: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

interface Props {
  groups: Group[];
}

export function CreateInstanceForm({ groups }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id ?? "");
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0];

  const maxRamMb = selectedGroup?.maxRamMb ?? 512;
  const maxCpuCores = selectedGroup?.maxCpuCores ?? 1;
  const maxDiskGb = selectedGroup?.maxDiskGb ?? 8;
  const maxSwapMb = selectedGroup?.maxSwapMb ?? 0;

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<OsTemplate[]>({
    queryKey: ["templates"],
    queryFn: () => fetch("/api/admin/templates").then((r) => r.json()),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      name: "",
      groupId: groups[0]?.id ?? "",
      ramMb: Math.min(512, maxRamMb),
      cpuCores: 1,
      diskGb: Math.min(8, maxDiskGb),
      swapMb: 0,
      osTemplate: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: FormData) {
    const res = await fetch("/api/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to create instance");
      return;
    }

    toast.success("Instance created successfully");
    qc.invalidateQueries({ queryKey: ["instances"] });
    router.push("/instances");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Group selector */}
        {groups.length > 1 && (
          <FormField
            control={form.control}
            name="groupId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Group</FormLabel>
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    setSelectedGroupId(val);
                    // reset resource fields to new group defaults
                    const g = groups.find((g) => g.id === val);
                    if (g) {
                      form.setValue("ramMb", Math.min(512, g.maxRamMb));
                      form.setValue("cpuCores", 1);
                      form.setValue("diskGb", Math.min(8, g.maxDiskGb));
                      form.setValue("swapMb", 0);
                    }
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedGroup && (
          <p className="text-xs text-muted-foreground -mt-2">
            Limits: {maxRamMb} MB RAM · {maxCpuCores} CPU · {maxDiskGb} GB disk · {selectedGroup.maxInstances}× instances
            {maxSwapMb > 0 ? ` · ${maxSwapMb} MB swap` : ""}
          </p>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hostname</FormLabel>
              <FormControl>
                <Input placeholder="my-container" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="osTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>OS Template</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoadingTemplates ? "Loading..." : "Select template"
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.template}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="ramMb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RAM (MB)</FormLabel>
                <FormControl>
                  <Input type="number" min={128} max={maxRamMb} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cpuCores"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPU Cores</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={maxCpuCores} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="diskGb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Disk (GB)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={maxDiskGb} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {maxSwapMb > 0 && (
          <FormField
            control={form.control}
            name="swapMb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Swap (MB)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={maxSwapMb} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? "Creating..." : "Create Instance"}
        </Button>
      </form>
    </Form>
  );
}
