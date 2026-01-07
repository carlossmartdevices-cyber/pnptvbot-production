export function parseYouTubeUrl(url) {
  try {
    const u = new URL(String(url || '').trim())
    if (!/(^|\.)youtube\.com$/.test(u.hostname) && u.hostname !== 'youtu.be') return null

    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id ? { kind: 'video', id } : null
    }

    const list = u.searchParams.get('list')
    const v = u.searchParams.get('v')
    if (list) return { kind: 'playlist', list }
    if (v) return { kind: 'video', id: v }

    if (u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/')[2]
      return id ? { kind: 'video', id } : null
    }

    return null
  } catch {
    return null
  }
}

export function toYouTubeEmbedUrl(info) {
  if (!info) return null
  if (info.kind === 'playlist') return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(info.list)}`
  if (info.kind === 'video') return `https://www.youtube.com/embed/${encodeURIComponent(info.id)}`
  return null
}

export async function tryYouTubeTitle(url) {
  try {
    const resp = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      method: 'GET',
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return typeof data?.title === 'string' ? data.title : null
  } catch {
    return null
  }
}

