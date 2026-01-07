export function tryTelegramReady() {
  try {
    window.Telegram?.WebApp?.ready?.()
  } catch {
    // ignore
  }
}

export function getTelegramUser() {
  try {
    const tg = window.Telegram?.WebApp
    const user = tg?.initDataUnsafe?.user
    if (!user?.id) return null

    const username = user.username ? `@${user.username}` : null
    const displayName = username || user.first_name || 'Anonymous'

    return {
      id: user.id,
      username: user.username || null,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      languageCode: user.language_code || null,
      displayName,
      initData: tg?.initData || null,
    }
  } catch {
    return null
  }
}
