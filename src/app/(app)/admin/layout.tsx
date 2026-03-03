import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";

/**
 * Admin route group layout — single, centralized isAdmin gate.
 * All pages under /admin/* inherit this check automatically.
 * Individual pages no longer need their own session/isAdmin verify.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");

  return <>{children}</>;
}
