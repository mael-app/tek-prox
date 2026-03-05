"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
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

interface Group {
  maxRamMb: number;
  maxCpuCores: number;
  maxDiskGb: number;
  maxSwapMb: number;
}

interface Props {
  vmid: number;
  current: {
    ramMb: number;
    cpuCores: number;
    diskGb: number;
    swapMb: number;
  };
  group: Group;
  isAdmin: boolean;
}

const schema = z.object({
  ramMb: z.coerce.number().int().min(128),
  cpuCores: z.coerce.number().int().min(1),
  diskGb: z.coerce.number().int().min(1),
  swapMb: z.coerce.number().int().min(0),
});

type FormData = z.infer<typeof schema>;

export function InstanceResourceEditor({ vmid, current, group, isAdmin }: Props) {
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      ramMb: current.ramMb,
      cpuCores: current.cpuCores,
      diskGb: current.diskGb,
      swapMb: current.swapMb,
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const watchedRam = form.watch("ramMb");
  const watchedCpu = form.watch("cpuCores");
  const watchedDisk = form.watch("diskGb");
  const watchedSwap = form.watch("swapMb");

  const quotaWarnings: string[] = [];
  if (isAdmin) {
    if (watchedRam > group.maxRamMb)
      quotaWarnings.push(`RAM: ${watchedRam} MB exceeds the group limit of ${group.maxRamMb} MB`);
    if (watchedCpu > group.maxCpuCores)
      quotaWarnings.push(`CPU: ${watchedCpu} cores exceeds the group limit of ${group.maxCpuCores}`);
    if (watchedDisk > group.maxDiskGb)
      quotaWarnings.push(`Disk: ${watchedDisk} GB exceeds the group limit of ${group.maxDiskGb} GB`);
    if (group.maxSwapMb > 0 && watchedSwap > group.maxSwapMb)
      quotaWarnings.push(`Swap: ${watchedSwap} MB exceeds the group limit of ${group.maxSwapMb} MB`);
  }

  const diskWillIncrease = watchedDisk > current.diskGb;

  async function onSubmit(data: FormData) {
    const changes: Partial<FormData> = {};
    if (data.ramMb !== current.ramMb) changes.ramMb = data.ramMb;
    if (data.cpuCores !== current.cpuCores) changes.cpuCores = data.cpuCores;
    if (data.diskGb !== current.diskGb) changes.diskGb = data.diskGb;
    if (data.swapMb !== current.swapMb) changes.swapMb = data.swapMb;

    if (Object.keys(changes).length === 0) {
      toast.info("No changes detected");
      return;
    }

    const res = await fetch(`/api/instances/${vmid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to update resources");
      return;
    }

    toast.success("Resources updated");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Group limits: {group.maxRamMb} MB RAM · {group.maxCpuCores} CPU · {group.maxDiskGb} GB disk
          {group.maxSwapMb > 0 ? ` · ${group.maxSwapMb} MB swap` : ""}
        </p>

        {isAdmin && quotaWarnings.length > 0 && (
          <div className="rounded-md border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-300">
            <p className="flex items-center gap-1.5 font-semibold mb-1">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              Quota override (admin)
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {quotaWarnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        {diskWillIncrease && (
          <div className="rounded-md border border-orange-400 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 text-sm text-orange-800 dark:text-orange-300 flex items-start gap-1.5">
            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Increasing the disk size is <strong>irreversible</strong> — it cannot be reduced afterwards.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="ramMb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RAM (MB)</FormLabel>
                <FormControl>
                  <Input type="number" min={128} max={isAdmin ? undefined : group.maxRamMb} {...field} />
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
                  <Input type="number" min={1} max={isAdmin ? undefined : group.maxCpuCores} {...field} />
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
                  <Input type="number" min={current.diskGb} max={isAdmin ? undefined : group.maxDiskGb} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {(isAdmin || group.maxSwapMb > 0) && (
          <FormField
            control={form.control}
            name="swapMb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Swap (MB)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={isAdmin ? undefined : group.maxSwapMb} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" disabled={isSubmitting} variant="outline" className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? "Updating..." : "Apply changes"}
        </Button>
      </form>
    </Form>
  );
}
