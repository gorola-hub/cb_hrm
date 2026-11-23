import { prisma } from '@/lib/prisma';

export async function findUserWithCredentialsByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
    include: {
      role: true,
      designation: true,
    },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      role: true,
      designation: true,
    },
  });
}

