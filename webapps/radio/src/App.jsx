import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import RadioPlayer from './components/RadioPlayer'
import {
  getUrlParams,
  fetchRadioNowPlaying,
} from './utils/api'

function App() {
  const [params, setParams] = useState(null)
  const [radioNowPlaying, setRadioNowPlaying] = useState(null)
  const [error, setError] = useState(null)
  const [telegramUser, setTelegramUser] = useState(null)
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const loginRef = useRef(null)

  useEffect(() => {
    const urlParams = getUrlParams()
    setParams(urlParams)

    loadRadioStatus()

    // Refresh radio status periodically
    const radioInterval = setInterval(loadRadioStatus, 30000)

    const TELEGRAM_BOT = 'pnplatinotv_bot'
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
      clearInterval(radioInterval)
      script.remove()
    }
  }, [])

  async function loadRadioStatus() {
    try {
      const nowPlaying = await fetchRadioNowPlaying()
      setRadioNowPlaying(nowPlaying)
    } catch (error) {
      console.error('Failed to load radio status:', error)
    }
  }

  function handleLogout() {
    setTelegramUser(null)
    setAuthMessage('')
  }

  return (
    <div className="app home">
      <Header
        title="PNPtv Radio"
        subtitle="24/7 Live Music"
        telegramUser={telegramUser}
        onLogout={handleLogout}
        loginRef={loginRef}
      />
      <RadioPlayer nowPlaying={radioNowPlaying} />
    </div>
  )
}

export default App