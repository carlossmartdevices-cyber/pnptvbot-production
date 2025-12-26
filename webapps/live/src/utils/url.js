/**
 * Get URL parameters
 * @returns {Object} URL parameters
 */
export function getUrlParams() {
  const params = new URLSearchParams(window.location.search)

  return {
    stream: params.get('stream'), // Live uses 'stream' not 'room'
    token: params.get('token'),
    uid: params.get('uid'),
    username: params.get('username') || 'Anonymous',
    role: params.get('role') || 'audience', // 'host' or 'audience'
    appId: params.get('appId') || 'b68ab7b61ea44eabab7f242171311c5e', // Default Agora App ID
  }
}
