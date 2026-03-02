"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Save } from "lucide-react";

const schema = z.object({
  sshPublicKey: z
    .string()
    .min(1, "SSH key is required")
    .refine(
      (k) =>
        k.startsWith("ssh-rsa ") ||
        k.startsWith("ssh-ed25519 ") ||
        k.startsWith("ecdsa-sha2-nistp") ||
        k.startsWith("sk-"),
      { message: "Invalid SSH public key format" }
    ),
});

type FormData = z.infer<typeof schema>;

export function SshKeyForm() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ sshPublicKey: string | null }>({
    queryKey: ["ssh-key"],
    queryFn: () => fetch("/api/settings/ssh-key").then((r) => r.json()),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sshPublicKey: "" },
  });

  useEffect(() => {
    if (data?.sshPublicKey) {
      form.setValue("sshPublicKey", data.sshPublicKey);
    }
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: (values: FormData) =>
      fetch("/api/settings/ssh-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error ?? "Failed to save");
        }
        return r.json();
      }),
    onSuccess: () => {
      toast.success("SSH key saved");
      queryClient.invalidateQueries({ queryKey: ["ssh-key"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="sshPublicKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SSH Public Key</FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  placeholder="ssh-ed25519 AAAA... user@host"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save SSH Key
        </Button>
      </form>
    </Form>
  );
}
