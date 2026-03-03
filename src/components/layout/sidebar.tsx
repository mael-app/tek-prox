"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProxmoxStatusIndicator } from "@/components/admin/proxmox-status";
import {
  LayoutDashboard,
  Server,
  Settings,
  Users,
  Network,
  Shield,
  LogOut,
  SlidersHorizontal,
  Box,
  ScrollText,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/instances", label: "Instances", icon: Server },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminItems = [
  { href: "/admin/groups", label: "Groups", icon: Shield },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/ip-ranges", label: "IP Ranges", icon: Network },
  { href: "/admin/templates", label: "Templates", icon: Box },
  { href: "/admin/settings", label: "Settings", icon: SlidersHorizontal },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen border-r bg-sidebar px-3 py-4">
      <div className="mb-6 px-2">
        <h1 className="text-xl font-bold tracking-tight">tek-prox</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Proxmox LXC Manager</p>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname.startsWith(href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}

        {session?.user.isAdmin && (
          <>
            <Separator className="my-2" />
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Admin
            </p>
            <ProxmoxStatusIndicator />
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname.startsWith(href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="mt-auto">
        <Separator className="mb-3" />
        <div className="flex items-center gap-2 px-2 mb-2">
          {session?.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-7 w-7 rounded-full"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{session?.user.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {session?.user.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
