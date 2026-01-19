// path: frontend/src/rbac/rbac.ts
export type Role = 'FREE' | 'PRIME' | 'ADMIN';
export type Action =
  | 'hangouts.listPublic'
  | 'hangouts.joinPublic'
  | 'hangouts.joinPrivate'
  | 'hangouts.create'
  | 'videorama.playPublic'
  | 'videorama.playPrime'
  | 'videorama.create'
  | 'videorama.editOwn'
  | 'videorama.editAny'
  | 'videorama.deleteOwn'
  | 'videorama.deleteAny';

interface Resource {
  ownerId?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'PRIME';
}

export function can(role: Role, action: Action, resource?: Resource): boolean {
  // FREE role permissions
  if (role === 'FREE') {
    if (action === 'hangouts.listPublic') return true;
    if (action === 'hangouts.joinPublic') return true;
    if (action === 'videorama.playPublic') return true;
    return false;
  }

  // PRIME role permissions
  if (role === 'PRIME') {
    if (action === 'hangouts.listPublic') return true;
    if (action === 'hangouts.joinPublic') return true;
    if (action === 'hangouts.joinPrivate') return true;
    if (action === 'hangouts.create') return true;
    if (action === 'videorama.playPublic') return true;
    if (action === 'videorama.playPrime') return true;
    if (action === 'videorama.create') return true;
    if (action === 'videorama.editOwn') return resource?.ownerId === 'current-user-id'; // Replace with actual user ID
    if (action === 'videorama.deleteOwn') return resource?.ownerId === 'current-user-id'; // Replace with actual user ID
    return false;
  }

  // ADMIN role permissions
  if (role === 'ADMIN') {
    if (action === 'hangouts.listPublic') return true;
    if (action === 'hangouts.joinPublic') return true;
    if (action === 'hangouts.joinPrivate') return true;
    if (action === 'hangouts.create') return true;
    if (action === 'videorama.playPublic') return true;
    if (action === 'videorama.playPrime') return true;
    if (action === 'videorama.create') return true;
    if (action === 'videorama.editOwn') return true;
    if (action === 'videorama.editAny') return true;
    if (action === 'videorama.deleteOwn') return true;
    if (action === 'videorama.deleteAny') return true;
    return false;
  }

  return false;
}