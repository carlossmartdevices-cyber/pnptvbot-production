import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api/webapp',
  withCredentials: true,
})

// Auto-redirect to login on 401
apiClient.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/auth/'
    }
    return Promise.reject(error)
  }
)

export default apiClient
