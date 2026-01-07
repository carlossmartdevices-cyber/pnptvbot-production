import { OFFICIAL_VIDEORAMA } from './videoramaCatalog'

const KEY = 'pnptv:videorama:featured:v1'

export const DEFAULT_FEATURED = [
  {
    id: 'featured-emotional-rollercoaster',
    title: 'PNPtv – Emotional Rollercoaster',
    category: 'Featured Videoramas',
    creator: '@Santino, Meth Daddy',
    description: 'This isn’t a playlist to put on shuffle. It’s a journey. Listen in order.',
    tracks: OFFICIAL_VIDEORAMA,
    createdAt: 0,
  },
]

export function loadFeaturedVideoramas() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const list = Array.isArray(parsed) ? parsed : []
    const normalized = list
      .filter(Boolean)
      .map((v) => ({
        id: String(v.id || crypto.randomUUID()),
        title: String(v.title || 'Untitled Videorama'),
        category: String(v.category || 'Featured Videoramas'),
        creator: String(v.creator || ''),
        description: String(v.description || ''),
        tracks: Array.isArray(v.tracks) ? v.tracks : [],
        createdAt: typeof v.createdAt === 'number' ? v.createdAt : Date.now(),
      }))
    return normalized
  } catch {
    return []
  }
}

export function saveFeaturedVideoramas(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list || []))
  } catch {
    // ignore
  }
}
