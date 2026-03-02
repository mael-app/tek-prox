import { getServerSession } from "next-auth";
import { authOptions } from "./options";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  return session;
}
