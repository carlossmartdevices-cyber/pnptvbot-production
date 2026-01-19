// path: backend/src/modules/videorama/videorama.test.ts
import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../auth/jwt';

const prisma = new PrismaClient();

describe('Videorama API', () => {
  let freeUserToken: string;
  let primeUserToken: string;
  let adminUserToken: string;
  let freeUserId: string;
  let primeUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Create test users
    const freeUser = await prisma.user.create({
      data: {
        telegramId: 'free-videorama-user',
        username: 'freevideouser',
        role: 'FREE',
        acceptedTermsAt: new Date()
      }
    });

    const primeUser = await prisma.user.create({
      data: {
        telegramId: 'prime-videorama-user',
        username: 'primevideouser',
        role: 'PRIME',
        acceptedTermsAt: new Date()
      }
    });

    const adminUser = await prisma.user.create({
      data: {
        telegramId: 'admin-videorama-user',
        username: 'adminvideouser',
        role: 'ADMIN',
        acceptedTermsAt: new Date()
      }
    });

    freeUserId = freeUser.id;
    primeUserId = primeUser.id;
    adminUserId = adminUser.id;

    // Generate tokens
    freeUserToken = generateToken({
      sub: freeUser.id,
      role: 'FREE',
      termsAccepted: true
    });

    primeUserToken = generateToken({
      sub: primeUser.id,
      role: 'PRIME',
      termsAccepted: true
    });

    adminUserToken = generateToken({
      sub: adminUser.id,
      role: 'ADMIN',
      termsAccepted: true
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.collection.deleteMany({
      where: {
        ownerId: {
          in: [freeUserId, primeUserId, adminUserId]
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        telegramId: {
          in: ['free-videorama-user', 'prime-videorama-user', 'admin-videorama-user']
        }
      }
    });
  });

  describe('GET /api/videorama', () => {
    beforeAll(async () => {
      // Create test collections
      await prisma.collection.create({
        data: {
          type: 'PLAYLIST',
          title: 'Public Collection',
          visibility: 'PUBLIC',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Video 1',
              url: 'https://youtube.com/watch?v=public1'
            }
          }
        }
      });

      await prisma.collection.create({
        data: {
          type: 'PLAYLIST',
          title: 'Prime Collection',
          visibility: 'PRIME',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Video 2',
              url: 'https://youtube.com/watch?v=prime1'
            }
          }
        }
      });

      await prisma.collection.create({
        data: {
          type: 'PODCAST',
          title: 'Private Collection',
          visibility: 'PRIVATE',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Podcast 1',
              url: 'https://youtube.com/watch?v=private1'
            }
          }
        }
      });
    });

    it('should return only PUBLIC collections for FREE users', async () => {
      const res = await request(app)
        .get('/api/videorama')
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1); // Only public collection
      expect(res.body[0].title).toBe('Public Collection');
    });

    it('should return PUBLIC and PRIME collections for PRIME users', async () => {
      const res = await request(app)
        .get('/api/videorama')
        .set('Authorization', `Bearer ${primeUserToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // Public and Prime collections
    });

    it('should return PUBLIC and PRIME collections for ADMIN users', async () => {
      const res = await request(app)
        .get('/api/videorama')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // Public and Prime collections
    });
  });

  describe('POST /api/videorama', () => {
    it('should allow PRIME users to create collections', async () => {
      const res = await request(app)
        .post('/api/videorama')
        .set('Authorization', `Bearer ${primeUserToken}`)
        .send({
          type: 'PLAYLIST',
          title: 'New Playlist',
          visibility: 'PUBLIC',
          items: [
            {
              title: 'Test Video',
              url: 'https://youtube.com/watch?v=test123'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Playlist');
      expect(res.body.items.length).toBe(1);
    });

    it('should allow ADMIN users to create collections', async () => {
      const res = await request(app)
        .post('/api/videorama')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          type: 'PODCAST',
          title: 'New Podcast',
          visibility: 'PRIME',
          items: [
            {
              title: 'Test Podcast',
              url: 'https://youtube.com/watch?v=podcast123'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Podcast');
    });

    it('should NOT allow FREE users to create collections', async () => {
      const res = await request(app)
        .post('/api/videorama')
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({
          type: 'PLAYLIST',
          title: 'New Playlist',
          visibility: 'PUBLIC',
          items: []
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/videorama/:id', () => {
    let publicCollectionId: string;
    let primeCollectionId: string;
    let privateCollectionId: string;

    beforeAll(async () => {
      // Create test collections
      const publicCollection = await prisma.collection.create({
        data: {
          type: 'PLAYLIST',
          title: 'Public Test Collection',
          visibility: 'PUBLIC',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Public Video',
              url: 'https://youtube.com/watch?v=public-test'
            }
          }
        }
      });

      const primeCollection = await prisma.collection.create({
        data: {
          type: 'PLAYLIST',
          title: 'Prime Test Collection',
          visibility: 'PRIME',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Prime Video',
              url: 'https://youtube.com/watch?v=prime-test'
            }
          }
        }
      });

      const privateCollection = await prisma.collection.create({
        data: {
          type: 'PODCAST',
          title: 'Private Test Collection',
          visibility: 'PRIVATE',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Private Podcast',
              url: 'https://youtube.com/watch?v=private-test'
            }
          }
        }
      });

      publicCollectionId = publicCollection.id;
      primeCollectionId = primeCollection.id;
      privateCollectionId = privateCollection.id;
    });

    it('should allow FREE users to access PUBLIC collections', async () => {
      const res = await request(app)
        .get(`/api/videorama/${publicCollectionId}`)
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Public Test Collection');
    });

    it('should allow PRIME users to access PRIME collections', async () => {
      const res = await request(app)
        .get(`/api/videorama/${primeCollectionId}`)
        .set('Authorization', `Bearer ${primeUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Prime Test Collection');
    });

    it('should NOT allow FREE users to access PRIME collections', async () => {
      const res = await request(app)
        .get(`/api/videorama/${primeCollectionId}`)
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow owner to access their PRIVATE collections', async () => {
      const res = await request(app)
        .get(`/api/videorama/${privateCollectionId}`)
        .set('Authorization', `Bearer ${primeUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Private Test Collection');
    });

    it('should allow ADMIN to access PRIVATE collections', async () => {
      const res = await request(app)
        .get(`/api/videorama/${privateCollectionId}`)
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Private Test Collection');
    });

    it('should NOT allow non-owner FREE users to access PRIVATE collections', async () => {
      const res = await request(app)
        .get(`/api/videorama/${privateCollectionId}`)
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/videorama/:id', () => {
    let collectionId: string;

    beforeAll(async () => {
      // Create a collection owned by prime user
      const collection = await prisma.collection.create({
        data: {
          type: 'PLAYLIST',
          title: 'Editable Collection',
          visibility: 'PUBLIC',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Original Video',
              url: 'https://youtube.com/watch?v=original'
            }
          }
        }
      });

      collectionId = collection.id;
    });

    it('should allow owner to update their collection', async () => {
      const res = await request(app)
        .put(`/api/videorama/${collectionId}`)
        .set('Authorization', `Bearer ${primeUserToken}`)
        .send({
          title: 'Updated Collection',
          items: [
            {
              title: 'Updated Video',
              url: 'https://youtube.com/watch?v=updated'
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Collection');
      expect(res.body.items.length).toBe(1);
    });

    it('should allow ADMIN to update any collection', async () => {
      const res = await request(app)
        .put(`/api/videorama/${collectionId}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          title: 'Admin Updated Collection'
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Admin Updated Collection');
    });

    it('should NOT allow non-owner to update collection', async () => {
      const res = await request(app)
        .put(`/api/videorama/${collectionId}`)
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({
          title: 'Unauthorized Update'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/videorama/:id', () => {
    let collectionId: string;

    beforeAll(async () => {
      // Create a collection owned by prime user
      const collection = await prisma.collection.create({
        data: {
          type: 'PLAYLIST',
          title: 'Deletable Collection',
          visibility: 'PUBLIC',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Video to Delete',
              url: 'https://youtube.com/watch?v=delete'
            }
          }
        }
      });

      collectionId = collection.id;
    });

    it('should allow owner to delete their collection', async () => {
      const res = await request(app)
        .delete(`/api/videorama/${collectionId}`)
        .set('Authorization', `Bearer ${primeUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow ADMIN to delete any collection', async () => {
      // Create another collection for admin to delete
      const adminCollection = await prisma.collection.create({
        data: {
          type: 'PLAYLIST',
          title: 'Admin Deletable Collection',
          visibility: 'PUBLIC',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Video',
              url: 'https://youtube.com/watch?v=admin-delete'
            }
          }
        }
      });

      const res = await request(app)
        .delete(`/api/videorama/${adminCollection.id}`)
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should NOT allow non-owner to delete collection', async () => {
      // Create another collection for testing
      const nonOwnerCollection = await prisma.collection.create({
        data: {
          type: 'PLAYLIST',
          title: 'Non Owner Collection',
          visibility: 'PUBLIC',
          ownerId: primeUserId,
          items: {
            create: {
              title: 'Video',
              url: 'https://youtube.com/watch?v=non-owner'
            }
          }
        }
      });

      const res = await request(app)
        .delete(`/api/videorama/${nonOwnerCollection.id}`)
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(res.status).toBe(403);
    });
  });
});