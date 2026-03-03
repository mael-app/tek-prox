"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Maps a current pathname to the URL we should navigate back to.
 * Returns null on top-level pages (no back button needed).
 */
function resolveBackHref(pathname: string): string | null {
  // /instances/new → /instances
  if (pathname === "/instances/new") return "/instances";
  // /instances/[vmid] → /instances
  if (/^\/instances\/\d+$/.test(pathname)) return "/instances";
  // /admin sub-pages are all top-level, no back button needed
  return null;
}

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  const backHref = resolveBackHref(pathname);
  if (!backHref) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 text-muted-foreground hover:text-foreground -ml-1 hidden md:flex"
      onClick={() => router.push(backHref)}
    >
      <ChevronLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
