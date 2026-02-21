import apiClient from './index.js'

export const profileAPI = {
  getProfile: () => apiClient.get('/profile'),
  updateProfile: (data) => apiClient.put('/profile', data),
  uploadAvatar: (formData) => apiClient.post('/profile/avatar', formData),
}

export const mediaAPI = {
  getVideorama: () => apiClient.get('/media/videorama'),
  getLiveStreams: () => apiClient.get('/live/streams'),
  getRadioNowPlaying: () => apiClient.get('/radio/now-playing'),
}

export const chatAPI = {
  getChatHistory: (room) => apiClient.get('/chat/' + room + '/history'),
  sendMessage: (room, msg) => apiClient.post('/chat/' + room + '/send', { message: msg }),
}

export default { profileAPI, mediaAPI, chatAPI }
