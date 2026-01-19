// path: backend/src/rbac/rbac.test.ts
import { can, Role, Action } from './rbac';

describe('RBAC Tests', () => {
  describe('FREE role permissions', () => {
    const role: Role = 'FREE';

    it('should allow listing public hangouts', () => {
      expect(can(role, 'hangouts.listPublic')).toBe(true);
    });

    it('should allow joining public hangouts', () => {
      expect(can(role, 'hangouts.joinPublic')).toBe(true);
    });

    it('should allow playing public videorama', () => {
      expect(can(role, 'videorama.playPublic')).toBe(true);
    });

    it('should NOT allow joining private hangouts', () => {
      expect(can(role, 'hangouts.joinPrivate')).toBe(false);
    });

    it('should NOT allow creating hangouts', () => {
      expect(can(role, 'hangouts.create')).toBe(false);
    });

    it('should NOT allow playing prime videorama', () => {
      expect(can(role, 'videorama.playPrime')).toBe(false);
    });

    it('should NOT allow creating videorama', () => {
      expect(can(role, 'videorama.create')).toBe(false);
    });
  });

  describe('PRIME role permissions', () => {
    const role: Role = 'PRIME';

    it('should allow listing public hangouts', () => {
      expect(can(role, 'hangouts.listPublic')).toBe(true);
    });

    it('should allow joining public hangouts', () => {
      expect(can(role, 'hangouts.joinPublic')).toBe(true);
    });

    it('should allow joining private hangouts', () => {
      expect(can(role, 'hangouts.joinPrivate')).toBe(true);
    });

    it('should allow creating hangouts', () => {
      expect(can(role, 'hangouts.create')).toBe(true);
    });

    it('should allow playing public videorama', () => {
      expect(can(role, 'videorama.playPublic')).toBe(true);
    });

    it('should allow playing prime videorama', () => {
      expect(can(role, 'videorama.playPrime')).toBe(true);
    });

    it('should allow creating videorama', () => {
      expect(can(role, 'videorama.create')).toBe(true);
    });

    it('should allow editing own videorama', () => {
      expect(can(role, 'videorama.editOwn', { ownerId: 'current-user-id' })).toBe(true);
    });

    it('should NOT allow editing other users videorama', () => {
      expect(can(role, 'videorama.editOwn', { ownerId: 'other-user-id' })).toBe(false);
    });

    it('should NOT allow editing any videorama', () => {
      expect(can(role, 'videorama.editAny')).toBe(false);
    });
  });

  describe('ADMIN role permissions', () => {
    const role: Role = 'ADMIN';

    it('should allow all hangouts actions', () => {
      expect(can(role, 'hangouts.listPublic')).toBe(true);
      expect(can(role, 'hangouts.joinPublic')).toBe(true);
      expect(can(role, 'hangouts.joinPrivate')).toBe(true);
      expect(can(role, 'hangouts.create')).toBe(true);
    });

    it('should allow all videorama actions', () => {
      expect(can(role, 'videorama.playPublic')).toBe(true);
      expect(can(role, 'videorama.playPrime')).toBe(true);
      expect(can(role, 'videorama.create')).toBe(true);
      expect(can(role, 'videorama.editOwn')).toBe(true);
      expect(can(role, 'videorama.editAny')).toBe(true);
      expect(can(role, 'videorama.deleteOwn')).toBe(true);
      expect(can(role, 'videorama.deleteAny')).toBe(true);
    });
  });

  describe('Resource-based permissions', () => {
    it('should handle undefined resource gracefully', () => {
      expect(can('PRIME', 'videorama.editOwn')).toBe(false);
    });

    it('should handle resource with ownerId', () => {
      expect(can('PRIME', 'videorama.editOwn', { ownerId: 'current-user-id' })).toBe(true);
      expect(can('PRIME', 'videorama.editOwn', { ownerId: 'other-user-id' })).toBe(false);
    });

    it('should handle resource with visibility', () => {
      expect(can('FREE', 'videorama.playPublic', { visibility: 'PUBLIC' })).toBe(true);
      expect(can('FREE', 'videorama.playPrime', { visibility: 'PRIME' })).toBe(false);
    });
  });
});