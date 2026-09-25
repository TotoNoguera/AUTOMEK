import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcrypt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      tallerId?: string; // Taller actual del usuario
    };
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const { allowed } = rateLimit(
          `login:${(credentials.email as string).toLowerCase()}`,
          10,
          15 * 60 * 1000
        );
        if (!allowed) {
          throw new Error("Demasiados intentos de inicio de sesión. Intentá nuevamente en unos minutos.");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
  },
  events: {
    // Al cerrar sesión, el identificador (jti) del token queda revocado hasta su vencimiento
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      const jti = token?.jti as string | undefined;
      if (!jti) return;
      try {
        const expiresAt = new Date(((token?.exp as number | undefined) ?? Math.floor(Date.now() / 1000) + 30 * 24 * 3600) * 1000);
        await db.revokedSession.upsert({ where: { jti }, update: {}, create: { jti, expiresAt } });
        await db.revokedSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      } catch (error) {
        console.error("No se pudo revocar la sesión:", error);
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.jti = crypto.randomUUID();
      }
      return token;
    },
    async session({ session, token }) {
      // Sesión revocada por logout: se devuelve sin usuario, de modo que las rutas responden 401
      if (token.jti) {
        const revoked = await db.revokedSession.findUnique({ where: { jti: token.jti as string }, select: { jti: true } });
        if (revoked) {
          return { ...session, user: undefined } as unknown as typeof session;
        }
      }
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
