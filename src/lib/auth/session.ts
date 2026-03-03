import { getServerSession } from "next-auth";
import { authOptions } from "./options";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  return session;
}

/**
 * Like requireSession but also asserts isAdmin.
 * Returns null when the user is unauthenticated OR not an admin.
 * API routes should return 401 on null (not 403) to avoid leaking that the
 * route exists; the actual distinction is handled by the error message.
 */
export async function requireAdmin() {
  const session = await requireSession();
  if (!session) return null;
  if (!session.user.isAdmin) return null;
  return session;
}
