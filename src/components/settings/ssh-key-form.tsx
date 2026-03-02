"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Save, Pencil, X, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

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

function keyType(key: string): string {
  const part = key.split(" ")[0];
  if (part === "ssh-ed25519") return "ED25519";
  if (part === "ssh-rsa") return "RSA";
  if (part.startsWith("ecdsa-sha2-nistp")) return "ECDSA";
  if (part.startsWith("sk-")) return "SK";
  return part;
}

function keyComment(key: string): string | null {
  const parts = key.trim().split(/\s+/);
  return parts.length >= 3 ? parts.slice(2).join(" ") : null;
}

export function SshKeyForm() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

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
      // Only auto-open editor if no key set yet
    } else if (data && !data.sshPublicKey) {
      setEditing(true);
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
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading...</p>;

  const currentKey = data?.sshPublicKey ?? null;

  return (
    <div className="space-y-4">
      {/* ── Current key display ── */}
      {currentKey && !editing && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
              <Badge variant="secondary" className="font-mono text-xs">
                {keyType(currentKey)}
              </Badge>
              {keyComment(currentKey) && (
                <span className="text-sm text-muted-foreground truncate max-w-55">
                  {keyComment(currentKey)}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="shrink-0 text-muted-foreground"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Change
            </Button>
          </div>
          <p className="font-mono text-xs text-muted-foreground break-all leading-relaxed">
            {currentKey.slice(0, 72)}…
          </p>
        </div>
      )}

      {/* ── Edit form ── */}
      {editing && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
            className="space-y-3"
          >
            <FormField
              control={form.control}
              name="sshPublicKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(currentKey && "sr-only")}>
                    SSH Public Key
                  </FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      autoFocus
                      className="flex min-h-30 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                      placeholder="ssh-ed25519 AAAA... user@host"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
              {currentKey && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    form.setValue("sshPublicKey", currentKey);
                    setEditing(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}

