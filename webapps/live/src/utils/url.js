/**
 * Get URL parameters
 * @returns {Object} URL parameters
 */
export function getUrlParams() {
  const params = new URLSearchParams(window.location.search)

  return {
    stream: params.get('stream'), // Stream ID for live streaming
    room: params.get('room'), // Room for hangouts (kept for backward compatibility)
    token: params.get('token'),
    uid: params.get('uid'),
    username: params.get('username') || 'Anonymous',
    type: params.get('type') || 'private', // main or private
    appId: params.get('appId') || 'b68ab7b61ea44eabab7f242171311c5e', // Default Agora App ID
    isHost: params.get('isHost') === 'true',
  }
}
