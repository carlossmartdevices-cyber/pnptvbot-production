export function uploadVideoramaVideo(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('POST', '/api/videorama/upload')
    xhr.responseType = 'json'

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return
      const pct = Math.round((evt.loaded / evt.total) * 100)
      if (typeof onProgress === 'function') onProgress({ loaded: evt.loaded, total: evt.total, pct })
    }

    xhr.onload = () => {
      const data = xhr.response
      if (xhr.status >= 200 && xhr.status < 300 && data?.success && data?.file?.url) {
        resolve(data.file)
        return
      }
      reject(new Error(data?.message || `Upload failed (${xhr.status})`))
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload canceled'))

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    const fd = new FormData()
    fd.append('video', file, file?.name || 'video')
    xhr.send(fd)
  })
}

export function uploadPodcastAudio(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('POST', '/api/podcasts/upload')
    xhr.responseType = 'json'

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return
      const pct = Math.round((evt.loaded / evt.total) * 100)
      if (typeof onProgress === 'function') onProgress({ loaded: evt.loaded, total: evt.total, pct })
    }

    xhr.onload = () => {
      const data = xhr.response
      if (xhr.status >= 200 && xhr.status < 300 && data?.success && data?.file?.url) {
        resolve(data.file)
        return
      }
      reject(new Error(data?.message || `Upload failed (${xhr.status})`))
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload canceled'))

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    const fd = new FormData()
    fd.append('audio', file, file?.name || 'audio')
    xhr.send(fd)
  })
}

export async function getPublicPlaylists(limit = 20) {
  const resp = await fetch(`/api/playlists/public?limit=${encodeURIComponent(String(limit))}`, { method: 'GET' })
  if (!resp.ok) throw new Error(`Failed to load playlists (${resp.status})`)
  return resp.json()
}
