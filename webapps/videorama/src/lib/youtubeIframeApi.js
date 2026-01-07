let ytApiPromise = null

export function loadYouTubeIframeApi({ timeoutMs = 15000 } = {}) {
  if (typeof window === 'undefined') return Promise.reject(new Error('YouTube API can only load in the browser'))

  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise

  ytApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-yt-iframe-api="1"]')
    if (!existing) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.defer = true
      s.dataset.ytIframeApi = '1'
      document.head.appendChild(s)
    }

    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof prev === 'function') prev()
      } catch {
        // ignore
      }
      if (window.YT && window.YT.Player) resolve(window.YT)
    }

    const timer = setTimeout(() => {
      reject(new Error('Timed out loading YouTube player'))
    }, timeoutMs)

    const poll = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearTimeout(timer)
        clearInterval(poll)
        resolve(window.YT)
      }
    }, 50)
  })

  return ytApiPromise
}

