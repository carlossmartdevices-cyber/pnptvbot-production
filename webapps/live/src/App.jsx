import { useEffect, useMemo, useRef, useState } from 'react'
import LiveStream from './components/LiveStream'
import { getUrlParams } from './utils/url'

const TELEGRAM_BOT = 'pnplatinotv_bot'

function App() {
  const params = useMemo(() => getUrlParams(), [])
  const [error, setError] = useState(null)
  const [telegramUser, setTelegramUser] = useState(null)
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const loginRef = useRef(null)

  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      if (!user) return
      setAuthLoading(true)
      setAuthMessage('Authenticating...')
      try {
        const response = await fetch('/api/telegram-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramUser: user }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Telegram authentication failed')
        }
        setTelegramUser({
          id: user.id,
          username: user.username,
          name: user.first_name,
          subscriptionStatus: data.user?.subscriptionStatus || 'free',
        })
        setAuthMessage('Welcome ' + (user.username || user.first_name || 'PNPtv user'))
      } catch (err) {
        setAuthMessage(err.message)
      } finally {
        setAuthLoading(false)
      }
    }

    if (!loginRef.current) return
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', TELEGRAM_BOT)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    loginRef.current.appendChild(script)
    return () => {
      script.remove()
    }
  }, [])

  if (error) {
    return (
      <div className="app">
        <section className="error-panel">
          <h2>Error</h2>
          <p>{error}</p>
        </section>
      </div>
    )
  }

  if (params.stream && params.token && params.uid) {
    return (
      <div className="app">
        <LiveStream {...params} />
      </div>
    )
  }

  const roleParam = telegramUser?.subscriptionStatus === 'active' ? 'PRIME' : 'FREE'
  const cards = [
    {
      title: 'Hangouts rooms',
      description:
        'Create or join group video rooms. Opens the Hangouts dashboard powered by Agora and protected via Telegram.',
      link: `/hangouts${roleParam ? `?role=${roleParam}` : ''}`,
    },
    {
      title: 'Videorama library',
      description:
        'Browse curated playlists, podcasts, and gated PRIME content while the bot keeps your membership synced.',
      link: '/videorama',
    },
    {
      title: 'PNP Live',
      description:
        'Launch premium live streams and get the join links/notifications sent through the Telegram bot.',
      link: '/pnplive?mode=live',
    },
  ]

  return (
    <div className="app hub">
      <div className="bg" />
      <header className="hub-header">
        <div>
          <p className="tag">PNPtv Unified Portal</p>
          <h1>Hangouts · Videorama · PNP Live</h1>
          <p>
            Login with Telegram to keep your subscriptions, calls, and notifications synced with the
            bot. All membership activations and live rooms produce Telegram notifications so you
            never miss an invite.
          </p>
        </div>
        <div className="auth-card">
          <p className="auth-title">Login with Telegram</p>
          <div ref={loginRef} />
          <p className="auth-status">
            {authLoading ? 'Waiting for Telegram...' : authMessage || 'Bot notifications will follow your Telegram account.'}
          </p>
        </div>
      </header>

      <section className="feature-grid">
        {FEATURE_CARDS.map((card) => (
          <article key={card.title} className="feature-card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <a href={card.link} className="feature-link">
              Open {card.title}
            </a>
          </article>
        ))}
      </section>

      <section className="api-section">
        <h2>API Endpoints</h2>
        <ul>
          <li>
            <strong>Hangouts</strong> – `pnptv.app/api/hangouts` (list/create/join). Handles Auth via
            Telegram init data and still delivers join notifications through the bot.
          </li>
          <li>
            <strong>Videorama</strong> – `pnptv.app/api/videorama/collections` provides curated content
            and respects PRIME access.
          </li>
          <li>
            <strong>PNP Live</strong> – `pnptv.app/pnplive?mode=live` boots the Agora stream that emits
            Telegram notifications for approved viewers and hosts.
          </li>
        </ul>
      </section>
    </div>
  )
}

export default App
