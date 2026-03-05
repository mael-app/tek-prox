import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { LoginButton } from "./login-button";
import { AlertCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not connect to Microsoft. Please try again.",
  OAuthCallback: "Authentication failed during callback. Please try again.",
  OAuthCreateAccount: "Could not create your account. Contact an administrator.",
  Callback: "An error occurred during sign in. Please try again.",
  AccessDenied:"Access denied. Make sure you're using your Epitech account.",
  default: "Something went wrong. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);
  // Only redirect when the session is fully valid (id present).
  // An invalidated token (force-logout / deleted user) still returns a non-null
  // session object from getServerSession, but without user.id — in that case we
  // must stay on the login page and let the cookie expire / be cleared.
  if (session?.user?.id) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default)
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">tek-prox</h1>
          <p className="text-muted-foreground mt-2">
            Epitech Proxmox Manager
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Use your Epitech Microsoft account to continue
          </p>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2.5 mb-5 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <LoginButton />
        </div>
      </div>
    </div>
  );
}
