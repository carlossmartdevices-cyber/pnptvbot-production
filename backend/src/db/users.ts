// path: backend/src/db/users.ts
import { PrismaClient } from '@prisma/client';
import { Role } from '../rbac/rbac';

const prisma = new PrismaClient();

export interface CreateUserData {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  photoUrl?: string | null;
  role: Role;
  acceptedTermsAt?: Date | null;
}

export async function getUserByTelegramId(telegramId: string) {
  return prisma.user.findUnique({
    where: { telegramId }
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id }
  });
}

export async function createUser(data: CreateUserData) {
  return prisma.user.create({
    data: {
      telegramId: data.telegramId,
      username: data.username,
      firstName: data.firstName,
      photoUrl: data.photoUrl,
      role: data.role,
      acceptedTermsAt: data.acceptedTermsAt
    }
  });
}

export async function updateUserTerms(userId: string, acceptedAt: Date) {
  return prisma.user.update({
    where: { id: userId },
    data: { acceptedTermsAt: acceptedAt }
  });
}

export async function updateUserRole(userId: string, role: Role) {
  return prisma.user.update({
    where: { id: userId },
    data: { role }
  });
}

export async function getUserWithMemberships(telegramId: string) {
  return prisma.user.findUnique({
    where: { telegramId },
    include: {
      memberships: {
        where: {
          expiresAt: { gt: new Date() }
        }
      }
    }
  });
}