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
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 2 * 24 * 60 * 60, // 2 days
  },
  callbacks: {
    async signIn({ user, profile }) {
      if (
        restrictedDomain &&
        restrictedDomain !== "false" &&
        user.email &&
        !user.email.endsWith(`@${restrictedDomain}`)
      ) {
        return false;
      }
      if (user.email) {
        const updates: Record<string, unknown> = { lastLoginAt: new Date() };
        // Sync name/image for pre-created users who sign in via OAuth for the first time
        if (!user.name && profile) {
          const p = profile as Record<string, string | undefined>;
          if (p.name) updates.name = p.name;
          const image = p.picture ?? p.image;
          if (image) updates.image = image;
        }
        // Use updateMany by email so it doesn't throw when user.id is the
        // provider's account ID (not the DB UUID) on first OAuth sign-in for
        // pre-created users.
        await db.user.updateMany({ where: { email: user.email }, data: updates });
      }
      return true;
    },
    async jwt({ token, user }) {
      // Reload user data from DB on every token refresh so that privilege
      // changes and force-logout take effect without requiring a new login.
      const userId = (user?.id ?? token.id) as string | undefined;
      if (!userId) return token; // already invalidated

      const dbUser = await db.user.findUnique({
        where: { id: userId },
        select: {
          forcedLogoutAt: true,
          groups: { include: { group: true } },
        },
      });

      if (!dbUser) return { ...token, id: null }; // user deleted

      // If a force-logout was issued after this token was created, invalidate it
      if (dbUser.forcedLogoutAt && token.iat) {
        if (dbUser.forcedLogoutAt.getTime() > (token.iat as number) * 1000) {
          return { ...token, id: null };
        }
      }

      token.id = userId;
      token.isAdmin = dbUser.groups.some((gm) => gm.group.isAdmin);
      token.groupId = dbUser.groups[0]?.groupId ?? null;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
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
