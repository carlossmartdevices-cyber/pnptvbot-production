// path: backend/src/modules/hangouts/hangouts.test.ts
import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../auth/jwt';

const prisma = new PrismaClient();

describe('Hangouts API', () => {
  let freeUserToken: string;
  let primeUserToken: string;
  let adminUserToken: string;

  beforeAll(async () => {
    // Create test users
    const freeUser = await prisma.user.create({
      data: {
        telegramId: 'free-test-user',
        username: 'freeuser',
        role: 'FREE',
        acceptedTermsAt: new Date()
      }
    });

    const primeUser = await prisma.user.create({
      data: {
        telegramId: 'prime-test-user',
        username: 'primeuser',
        role: 'PRIME',
        acceptedTermsAt: new Date()
      }
    });

    const adminUser = await prisma.user.create({
      data: {
        telegramId: 'admin-test-user',
        username: 'adminuser',
        role: 'ADMIN',
        acceptedTermsAt: new Date()
      }
    });

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
    await prisma.room.deleteMany({
      where: {
        hostId: {
          in: ['free-test-user', 'prime-test-user', 'admin-test-user']
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        telegramId: {
          in: ['free-test-user', 'prime-test-user', 'admin-test-user']
        }
      }
    });
  });

  describe('GET /api/hangouts/public', () => {
    it('should return public rooms for authenticated users', async () => {
      const res = await request(app)
        .get('/api/hangouts/public')
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/hangouts/public');

      expect(res.status).toBe(401);
    });

    it('should require terms acceptance', async () => {
      // Create a user without terms accepted
      const userWithoutTerms = await prisma.user.create({
        data: {
          telegramId: 'no-terms-user',
          username: 'noterms',
          role: 'FREE',
          acceptedTermsAt: null
        }
      });

      const token = generateToken({
        sub: userWithoutTerms.id,
        role: 'FREE',
        termsAccepted: false
      });

      const res = await request(app)
        .get('/api/hangouts/public')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);

      // Clean up
      await prisma.user.delete({ where: { id: userWithoutTerms.id } });
    });
  });

  describe('POST /api/hangouts', () => {
    it('should allow PRIME users to create rooms', async () => {
      const res = await request(app)
        .post('/api/hangouts')
        .set('Authorization', `Bearer ${primeUserToken}`)
        .send({
          title: 'Test Public Room',
          visibility: 'PUBLIC'
        });

      expect(res.status).toBe(200);
      expect(res.body.room).toHaveProperty('id');
      expect(res.body.room.title).toBe('Test Public Room');
      expect(res.body.room.visibility).toBe('PUBLIC');
    });

    it('should allow ADMIN users to create rooms', async () => {
      const res = await request(app)
        .post('/api/hangouts')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          title: 'Test Private Room',
          visibility: 'PRIVATE'
        });

      expect(res.status).toBe(200);
      expect(res.body.room).toHaveProperty('id');
      expect(res.body.room.visibility).toBe('PRIVATE');
      expect(res.body.joinLink).toBeDefined();
    });

    it('should NOT allow FREE users to create rooms', async () => {
      const res = await request(app)
        .post('/api/hangouts')
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({
          title: 'Test Room',
          visibility: 'PUBLIC'
        });

      expect(res.status).toBe(403);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/hangouts')
        .send({
          title: 'Test Room',
          visibility: 'PUBLIC'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/hangouts/:roomId/join', () => {
    let publicRoomId: string;
    let privateRoomId: string;

    beforeAll(async () => {
      // Create test rooms
      const publicRoom = await prisma.room.create({
        data: {
          title: 'Test Public Room',
          visibility: 'PUBLIC',
          hostId: 'prime-test-user',
          channelName: 'test-public-channel',
          status: 'OPEN'
        }
      });

      const privateRoom = await prisma.room.create({
        data: {
          title: 'Test Private Room',
          visibility: 'PRIVATE',
          hostId: 'prime-test-user',
          channelName: 'test-private-channel',
          status: 'OPEN',
          joinTokenHash: 'test-token-hash'
        }
      });

      publicRoomId = publicRoom.id;
      privateRoomId = privateRoom.id;
    });

    it('should allow FREE users to join public rooms', async () => {
      const res = await request(app)
        .post(`/api/hangouts/${publicRoomId}/join`)
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.room.id).toBe(publicRoomId);
      expect(res.body.agora).toHaveProperty('rtcToken');
    });

    it('should allow PRIME users to join private rooms with valid token', async () => {
      const res = await request(app)
        .post(`/api/hangouts/${privateRoomId}/join`)
        .set('Authorization', `Bearer ${primeUserToken}`)
        .send({
          joinToken: `${privateRoomId}-${Date.now()}`
        });

      expect(res.status).toBe(200);
      expect(res.body.room.id).toBe(privateRoomId);
      expect(res.body.agora).toHaveProperty('rtcToken');
    });

    it('should NOT allow FREE users to join private rooms', async () => {
      const res = await request(app)
        .post(`/api/hangouts/${privateRoomId}/join`)
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({
          joinToken: `${privateRoomId}-${Date.now()}`
        });

      expect(res.status).toBe(403);
    });

    it('should require join token for private rooms', async () => {
      const res = await request(app)
        .post(`/api/hangouts/${privateRoomId}/join`)
        .set('Authorization', `Bearer ${primeUserToken}`);

      expect(res.status).toBe(400);
    });
  });
});