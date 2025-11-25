/**
 * Get URL parameters
 * @returns {Object} URL parameters
 */
export function getUrlParams() {
  const params = new URLSearchParams(window.location.search)

  return {
    room: params.get('room'),
    token: params.get('token'),
    uid: params.get('uid'),
    username: params.get('username') || 'Anonymous',
    type: params.get('type') || 'private', // main or private
    appId: params.get('appId') || 'b68ab7b61ea44eabab7f242171311c5e', // Default Agora App ID
  }
}
