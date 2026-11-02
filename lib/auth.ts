import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google({
    authorization: {
      params: {
        access_type: "offline",
        prompt: "consent",
        scope: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/forms.body",
          "https://www.googleapis.com/auth/forms.responses.readonly"
        ].join(" ")
      }
    }
  })],
  session: { strategy: "database" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.id && account.scope) {
        await prisma.account.updateMany({
          where: {
            userId: user.id,
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
          data: {
            ...(account.access_token ? { access_token: account.access_token } : {}),
            ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
            ...(typeof account.expires_at === "number" ? { expires_at: account.expires_at } : {}),
            scope: account.scope,
          },
        });
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    }
  }
});
