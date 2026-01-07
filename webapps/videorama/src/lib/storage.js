const KEY = 'pnptv:videorama:items:v1'

export function loadItems() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((it) => ({
      id: String(it.id || crypto.randomUUID()),
      title: String(it.title || 'Untitled'),
      url: String(it.url || ''),
      kind: it.kind === 'upload' ? 'upload' : 'link',
      createdAt: typeof it.createdAt === 'number' ? it.createdAt : Date.now(),
      description: String(it.description || ''),
    }))
  } catch {
    return []
  }
}

export function saveItems(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items || []))
  } catch {
    // ignore
  }
}

