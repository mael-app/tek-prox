"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export function ForceLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleForceLogout() {
    setLoading(true);
    const res = await fetch("/api/me/force-logout", { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to invalidate sessions");
      setLoading(false);
      return;
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={loading}
      onClick={handleForceLogout}
    >
      <LogOut className="h-4 w-4 mr-2" />
      Invalidate all sessions
    </Button>
  );
}
