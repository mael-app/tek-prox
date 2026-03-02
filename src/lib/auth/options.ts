import { NextAuthOptions } from "next-auth";
import type { AdapterAccount } from "next-auth/adapters";
import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";

const restrictedDomain = process.env.RESTRICT_MICROSOFT_DOMAIN;

function buildAdapter() {
  const adapter = PrismaAdapter(db);
  const originalLinkAccount = adapter.linkAccount!.bind(adapter);
  adapter.linkAccount = async (account: AdapterAccount) => {
    try {
      return await originalLinkAccount(account);
    } catch (error) {
      // Roll back the user that was created just before this call
      await db.user.delete({ where: { id: account.userId } }).catch(() => {});
      throw error;
    }
  };
  return adapter;
}

export const authOptions: NextAuthOptions = {
  adapter: buildAdapter(),
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (
        restrictedDomain &&
        restrictedDomain !== "false" &&
        user.email &&
        !user.email.endsWith(`@${restrictedDomain}`)
      ) {
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      // Reload group membership from DB on every token refresh so that
      // privilege changes (admin grant/revoke, group reassignment) take
      // effect immediately without requiring a new login.
      const userId = (user?.id ?? token.id) as string | undefined;
      if (userId) {
        token.id = userId;
        const groups = await db.groupMember.findMany({
          where: { userId },
          include: { group: true },
        });
        token.isAdmin = groups.some((gm) => gm.group.isAdmin);
        token.groupId = groups[0]?.groupId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.groupId = token.groupId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
