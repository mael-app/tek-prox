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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, ChevronsUpDown, Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** Current number of instances in the group (provided for admins to compute quota warnings) */
  instanceCount?: number;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  groups: { group: Group }[];
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
  targetUserId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  groups: Group[];
  adminUsers?: AdminUser[] | null;
}

export function CreateInstanceForm({ groups, adminUsers }: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const isAdmin = adminUsers != null;

  const [targetUserId, setTargetUserId] = useState<string>("");
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);

  // groups prop is always the relevant list: all groups for admins, own groups for regular users.
  const effectiveGroups: Group[] = groups;

  const [selectedGroupId, setSelectedGroupId] = useState<string>(effectiveGroups[0]?.id ?? "");
  const selectedGroup = effectiveGroups.find((g) => g.id === selectedGroupId) ?? effectiveGroups[0];

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
      groupId: effectiveGroups[0]?.id ?? "",
      ramMb: Math.min(512, maxRamMb),
      cpuCores: 1,
      diskGb: Math.min(8, maxDiskGb),
      swapMb: 0,
      osTemplate: "",
      targetUserId: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  // Quota warnings for admins — computed from live form values (must be after useForm)
  const watchedRam = form.watch("ramMb");
  const watchedCpu = form.watch("cpuCores");
  const watchedDisk = form.watch("diskGb");
  const watchedSwap = form.watch("swapMb");

  const quotaWarnings: string[] = [];
  if (isAdmin && selectedGroup) {
    if ((selectedGroup.instanceCount ?? 0) >= selectedGroup.maxInstances)
      quotaWarnings.push(`Instances: groupe déjà à ${selectedGroup.instanceCount ?? 0}/${selectedGroup.maxInstances}`);
    if (watchedRam > maxRamMb)
      quotaWarnings.push(`RAM: ${watchedRam} MB dépasse la limite de ${maxRamMb} MB`);
    if (watchedCpu > maxCpuCores)
      quotaWarnings.push(`CPU: ${watchedCpu} cœurs dépasse la limite de ${maxCpuCores}`);
    if (watchedDisk > maxDiskGb)
      quotaWarnings.push(`Disque: ${watchedDisk} GB dépasse la limite de ${maxDiskGb} GB`);
    if (maxSwapMb > 0 && watchedSwap > maxSwapMb)
      quotaWarnings.push(`Swap: ${watchedSwap} MB dépasse la limite de ${maxSwapMb} MB`);
  }

  function handleUserChange(userId: string) {
    setTargetUserId(userId);
    form.setValue("targetUserId", userId);
    // The group list doesn't change when switching target user (admin always sees all groups).
  }

  async function onSubmit(data: FormData) {
    const body: Record<string, unknown> = { ...data };
    if (!body.targetUserId) delete body.targetUserId;

    const res = await fetch("/api/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
        {/* Admin: target user selector with search */}
        {adminUsers && (
          <FormField
            control={form.control}
            name="targetUserId"
            render={({ field }) => {
              const selectedUser = adminUsers.find((u) => u.id === field.value);
              const displayLabel = selectedUser
                ? (selectedUser.name
                    ? `${selectedUser.name} — ${selectedUser.email}`
                    : (selectedUser.email ?? selectedUser.id))
                : "Myself (admin)";

              return (
                <FormItem>
                  <FormLabel>On behalf of</FormLabel>
                  <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">{displayLabel}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search user..." />
                        <CommandList>
                          <CommandEmpty>No user found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="_self"
                              onSelect={() => {
                                field.onChange("");
                                handleUserChange("");
                                setUserPopoverOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100" : "opacity-0")} />
                              Myself (admin)
                            </CommandItem>
                            {adminUsers.map((u) => {
                              const label = u.name ? `${u.name} — ${u.email}` : (u.email ?? u.id);
                              return (
                                <CommandItem
                                  key={u.id}
                                  value={label}
                                  onSelect={() => {
                                    field.onChange(u.id);
                                    handleUserChange(u.id);
                                    setUserPopoverOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", field.value === u.id ? "opacity-100" : "opacity-0")} />
                                  {label}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        )}

        {/* Group selector — always visible for admins, otherwise only when there are multiple choices */}
        {(isAdmin || effectiveGroups.length > 1) && (
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
                    const g = effectiveGroups.find((g) => g.id === val);
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
                    {effectiveGroups.map((g) => (
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

        {/* Quota override warning (admins only) */}
        {isAdmin && quotaWarnings.length > 0 && (
          <div className="rounded-md border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-300">
            <p className="flex items-center gap-1.5 font-semibold mb-1">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              Dépassement de quota (admin)
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {quotaWarnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="ramMb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RAM (MB)</FormLabel>
                <FormControl>
                  <Input type="number" min={128} max={isAdmin ? undefined : maxRamMb} {...field} />
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
                  <Input type="number" min={1} max={isAdmin ? undefined : maxCpuCores} {...field} />
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
                  <Input type="number" min={1} max={isAdmin ? undefined : maxDiskGb} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {(isAdmin || maxSwapMb > 0) && (
          <FormField
            control={form.control}
            name="swapMb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Swap (MB)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={isAdmin ? undefined : maxSwapMb} {...field} />
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
