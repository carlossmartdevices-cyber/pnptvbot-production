import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Radio, Sparkles, Users, Video } from 'lucide-react'
import { getUrlParams } from './utils/url'

const TELEGRAM_BOT = 'pnplatinotv_bot'
const LiveStream = lazy(() => import('./components/LiveStream'))

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
      <div className="app live-view">
        <Suspense
          fallback={
            <div className="loading">
              <div className="spinner" />
              <p>Loading stream...</p>
            </div>
          }
        >
          <LiveStream {...params} />
        </Suspense>
      </div>
    )
  }

  const roleParam = telegramUser?.subscriptionStatus === 'active' ? 'PRIME' : 'FREE'
  const displayName = telegramUser?.username || telegramUser?.name || 'PNPtv user'
  const membershipLabel = telegramUser
    ? telegramUser.subscriptionStatus === 'active'
      ? 'PRIME Active'
      : 'Free Access'
    : 'Not linked'
  const featureCards = [
    {
      title: 'Hangouts rooms',
      description:
        'Create or join group video rooms. Opens the Hangouts dashboard powered by Agora and protected via Telegram.',
      link: `/hangouts${roleParam ? `?role=${roleParam}` : ''}`,
      icon: Users,
    },
    {
      title: 'Videorama library',
      description:
        'Browse curated playlists, podcasts, and gated PRIME content while the bot keeps your membership synced.',
      link: '/videorama',
      icon: Video,
    },
    {
      title: 'PNP Live',
      description:
        'Launch premium live streams and get the join links/notifications sent through the Telegram bot.',
      link: '/pnplive?mode=live',
      icon: Radio,
    },
  ]
  const steps = [
    {
      title: 'Connect Telegram',
      description: 'Verify your account once so invites and member status stay synced.',
    },
    {
      title: 'Pick your experience',
      description: 'Open Hangouts, Videorama, or PNP Live from the cards below.',
    },
    {
      title: 'Go live together',
      description: 'Start a stream or room and share the instant join link.',
    },
  ]

  return (
    <div className="app hub">
      <div className="bg" />
      <header className="hub-header">
        <div className="hero-copy">
          <p className="tag">PNPtv Unified Portal</p>
          <h1>Hangouts, Videorama, and Live — synced by Telegram.</h1>
          <p>
            Login with Telegram to keep subscriptions, calls, and notifications synced with the
            bot. All membership activations and live rooms produce Telegram notifications so you
            never miss an invite.
          </p>
          <div className="hero-actions">
            <a className="btn btnPrimary" href={`/hangouts${roleParam ? `?role=${roleParam}` : ''}`}>
              Open Hangouts
            </a>
            <a className="btn btnGhost" href="/videorama">
              Browse Videorama
            </a>
          </div>
          <div className="hero-chips">
            <span className="chip chipAccent">
              <Sparkles size={14} /> Telegram linked access
            </span>
            <span className="chip">Live invites</span>
            <span className="chip">Member sync</span>
          </div>
        </div>
        <div className="auth-card">
          <p className="auth-title">Login with Telegram</p>
          <div ref={loginRef} className="telegram-widget" />
          <p className="auth-status">
            {authLoading
              ? 'Waiting for Telegram...'
              : authMessage || 'Bot notifications will follow your Telegram account.'}
          </p>
          <div className="auth-meta">
            <div>
              <span className="auth-label">Account</span>
              <span className="auth-value">{telegramUser ? displayName : 'Not linked'}</span>
            </div>
            <div>
              <span className="auth-label">Membership</span>
              <span className="auth-value">{membershipLabel}</span>
            </div>
          </div>
        </div>
      </header>

      <section className="feature-grid">
        {featureCards.map((card) => {
          const Icon = card.icon
          return (
          <article key={card.title} className="feature-card">
            <div className="feature-icon">
              <Icon size={22} />
            </div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <a href={card.link} className="feature-link">
              Open {card.title}
            </a>
          </article>
          )
        })}
      </section>

      <section className="steps-section">
        <h2>Launch in 3 steps</h2>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <div key={step.title} className="step-card">
              <div className="step-index">0{index + 1}</div>
              <div className="step-title">{step.title}</div>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
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
