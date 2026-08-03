import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// NextAuth defaults this cookie to host-only, so a browser will never send it
// to a different host — even a sibling subdomain on the same parent domain
// (that's not a CORS concern, CORS only governs whether a script can *read*
// a response, not whether the browser attaches a cookie to the request).
// Since the Java API now lives on its own subdomain (e.g. api.sunsetbeach.com
// next to www.sunsetbeach.com), the cookie has to be scoped to the shared
// parent domain in production or every credentialed admin fetch will 401.
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  ...(cookieDomain && {
    cookies: {
      sessionToken: {
        name:
          process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.NODE_ENV === "production",
          domain: cookieDomain,
        },
      },
    },
  }),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
