function normalizeTelegramUsername(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const noAt = raw.replace(/^@+/, '').trim()
  if (!noAt) return null
  return `@${noAt}`
}

function getQueryParam(name) {
  try {
    const params = new URLSearchParams(window.location.search || '')
    const v = params.get(name)
    return v ? String(v) : null
  } catch {
    return null
  }
}

export function getTelegramCreator() {
  try {
    const stored = localStorage.getItem('pnptv:tg:username')
    const q =
      getQueryParam('tg') ||
      getQueryParam('telegram') ||
      getQueryParam('username') ||
      getQueryParam('u')

    const normalized = normalizeTelegramUsername(q || stored)
    if (normalized) localStorage.setItem('pnptv:tg:username', normalized)
    return normalized
  } catch {
    return null
  }
}

