const KEY = 'pnptv:videorama:podcasts:v1'

export function loadPodcasts() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((it) => ({
      id: String(it.id || crypto.randomUUID()),
      title: String(it.title || 'Untitled'),
      url: String(it.url || ''),
      kind: 'audio',
      createdAt: typeof it.createdAt === 'number' ? it.createdAt : Date.now(),
      description: String(it.description || ''),
    }))
  } catch {
    return []
  }
}

export function savePodcasts(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items || []))
  } catch {
    // ignore
  }
}

