import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers: [
    Google({
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
            "https://www.googleapis.com/auth/forms.responses.readonly",
          ].join(" "),
        },
      },
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.id && account.scope) {
        try {
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
        } catch (err) {
          console.warn("[Auth] Account scope update warning:", err);
        }
      }

      // Ensure every teacher has a unique schoolKey that isolates their students
      // from other schools. The key is set to the user's own id on first sign-in
      // and never changed, so existing StudentIdentity records remain valid.
      // Using user.id (not the shared "default") prevents cross-school collisions.
      if (user.id) {
        try {
          const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { schoolKey: true },
          });
          // Only overwrite if the key still carries the unsafe legacy default value.
          if (existing && existing.schoolKey === "default") {
            await prisma.user.update({
              where: { id: user.id },
              data: { schoolKey: user.id },
            });
          }
        } catch (err) {
          console.warn("[Auth] schoolKey check skipped or column pending migration:", err);
        }
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
