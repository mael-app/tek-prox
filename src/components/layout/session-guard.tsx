"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

/**
 * Watches the client-side session. When NextAuth still considers the user
 * "authenticated" (cookie present) but the JWT has been invalidated
 * (id: null, e.g. after force-logout or account deletion), we call signOut()
 * to clear the cookie. This prevents the infinite redirect loop:
 *   layout → /login (no id) → NextAuth → /dashboard (has session) → loop
 */
export function SessionGuard() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && !session?.user?.id) {
      signOut({ redirect: true, callbackUrl: "/login" });
    }
  }, [session, status]);

  return null;
}
