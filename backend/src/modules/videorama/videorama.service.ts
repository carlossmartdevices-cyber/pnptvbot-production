// path: backend/src/modules/videorama/videorama.service.ts
import { PrismaClient } from '@prisma/client';
import { can } from '../../rbac/rbac';

const prisma = new PrismaClient();

export interface CreateCollectionData {
  type: 'PLAYLIST' | 'PODCAST';
  title: string;
  description?: string;
  ownerId: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'PRIME';
  items: Array<{
    title: string;
    url: string;
    duration?: number;
    meta?: any;
  }>;
}

export interface UpdateCollectionData {
  title?: string;
  description?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'PRIME';
  items?: Array<{
    id?: string;
    title: string;
    url: string;
    duration?: number;
    meta?: any;
  }>;
}

export async function createCollection(data: CreateCollectionData) {
  return prisma.collection.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      ownerId: data.ownerId,
      visibility: data.visibility,
      items: {
        create: data.items.map(item => ({
          title: item.title,
          url: item.url,
          duration: item.duration,
          meta: item.meta
        }))
      }
    },
    include: {
      items: true
    }
  });
}

export async function getCollectionsByUser(userId: string) {
  return prisma.collection.findMany({
    where: { ownerId: userId },
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getCollectionById(id: string) {
  return prisma.collection.findUnique({
    where: { id },
    include: { items: true }
  });
}

export async function updateCollection(
  id: string,
  data: UpdateCollectionData
) {
  return prisma.collection.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      visibility: data.visibility,
      items: data.items ? {
        deleteMany: {},
        create: data.items.map(item => ({
          title: item.title,
          url: item.url,
          duration: item.duration,
          meta: item.meta
        }))
      } : undefined
    },
    include: { items: true }
  });
}

export async function deleteCollection(id: string) {
  return prisma.collection.delete({
    where: { id }
  });
}

export async function getCollectionsForUser(
  userRole: string,
  userId: string
) {
  // FREE users can only see PUBLIC collections
  if (userRole === 'FREE') {
    return prisma.collection.findMany({
      where: {
        visibility: 'PUBLIC'
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  // PRIME and ADMIN users can see PUBLIC and PRIME collections
  return prisma.collection.findMany({
    where: {
      visibility: {
        in: ['PUBLIC', 'PRIME']
      }
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function canUserEditCollection(
  userId: string,
  collectionOwnerId: string,
  userRole: string
): Promise<boolean> {
  // ADMIN can edit any collection
  if (userRole === 'ADMIN') {
    return true;
  }

  // PRIME can edit their own collections
  if (userRole === 'PRIME' && userId === collectionOwnerId) {
    return true;
  }

  return false;
}

export async function canUserDeleteCollection(
  userId: string,
  collectionOwnerId: string,
  userRole: string
): Promise<boolean> {
  // ADMIN can delete any collection
  if (userRole === 'ADMIN') {
    return true;
  }

  // PRIME can delete their own collections
  if (userRole === 'PRIME' && userId === collectionOwnerId) {
    return true;
  }

  return false;
}