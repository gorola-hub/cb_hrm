import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authenticateUser } from '@/service/auth.service';
import { RoleObject, DesignationObject } from '@/types/next-auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const result = await authenticateUser({
          email: credentials.email as string,
          password: credentials.password as string,
        });

        if (!result.success) {
          throw new Error(result.error.code);
        }

        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          designation: result.user.designation,
          empId: result.user.empId,
          alias: result.user.alias,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.designation = user.designation;
        token.empId = user.empId;
        token.alias = user.alias;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as RoleObject;
        session.user.designation = token.designation as DesignationObject | null;
        session.user.empId = token.empId as string | null;
        session.user.alias = token.alias as string | null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-must-be-at-least-32-chars-long',
});

