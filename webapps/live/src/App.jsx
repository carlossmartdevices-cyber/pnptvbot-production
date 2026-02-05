import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import MediaGrid from './components/MediaGrid'
import VideoPlayer from './components/VideoPlayer'
import MiniRadioPlayer from './components/MiniRadioPlayer'
import CategoryNav from './components/CategoryNav'
import {
  getUrlParams,
  fetchMediaLibrary,
  fetchRadioNowPlaying,
} from './utils/api'

// Demo data for when API is not available
const DEMO_MEDIA = [
  {
    id: '1',
    title: 'Welcome to PNPtv',
    artist: 'PNPtv Team',
    type: 'video',
    category: 'featured',
    duration: 180,
    cover_url: 'https://picsum.photos/seed/pnp1/400/225',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
  },
  {
    id: '2',
    title: 'Community Highlights',
    artist: 'PNPtv Community',
    type: 'video',
    category: 'featured',
    duration: 240,
    cover_url: 'https://picsum.photos/seed/pnp2/400/225',
    url: 'https://www.w3schools.com/html/movie.mp4',
  },
  {
    id: '3',
    title: 'Latin Vibes Mix',
    artist: 'DJ PNP',
    type: 'audio',
    category: 'music',
    duration: 3600,
    cover_url: 'https://picsum.photos/seed/pnp3/400/400',
    url: '',
  },
  {
    id: '4',
    title: 'PNPtv Podcast Ep. 1',
    artist: 'The PNP Crew',
    type: 'audio',
    category: 'podcast',
    duration: 2400,
    cover_url: 'https://picsum.photos/seed/pnp4/400/400',
    url: '',
  },
  {
    id: '5',
    title: 'Best of the Week',
    artist: 'Various Artists',
    type: 'video',
    category: 'videos',
    duration: 600,
    cover_url: 'https://picsum.photos/seed/pnp5/400/225',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
  },
  {
    id: '6',
    title: 'Dance Party Mix',
    artist: 'DJ Latino',
    type: 'audio',
    category: 'music',
    duration: 4200,
    cover_url: 'https://picsum.photos/seed/pnp6/400/400',
    url: '',
  },
]

function App() {
  const [params, setParams] = useState(null)
  const [currentView, setCurrentView] = useState('home')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [mediaLibrary, setMediaLibrary] = useState([])
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [radioNowPlaying, setRadioNowPlaying] = useState(null)
  const [isRadioExpanded, setIsRadioExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [telegramUser, setTelegramUser] = useState(null)
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const loginRef = useRef(null)

  useEffect(() => {
    const urlParams = getUrlParams()
    setParams(urlParams)
    setCurrentView(urlParams.view || 'home')

    loadMedia()
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

  async function loadMedia(category = null) {
    setLoading(true)
    try {
      const media = await fetchMediaLibrary('all', category)
      setMediaLibrary(media.length > 0 ? media : DEMO_MEDIA)
    } catch (error) {
      console.error('Failed to load media, using demo data:', error)
      setMediaLibrary(DEMO_MEDIA)
    }
    setLoading(false)
  }

  async function loadRadioStatus() {
    try {
      const nowPlaying = await fetchRadioNowPlaying()
      setRadioNowPlaying(nowPlaying)
    } catch (error) {
      console.error('Failed to load radio status:', error)
    }
  }

  function handleCategoryChange(category) {
    setSelectedCategory(category)
    if (category === 'all') {
      loadMedia()
    } else if (category === 'radio') {
      setIsRadioExpanded(true)
    } else {
      loadMedia(category)
    }
  }

  function handleMediaSelect(media) {
    setSelectedMedia(media)
    setCurrentView('player')
  }

    function handleLogout() {
    setTelegramUser(null)
    setAuthMessage('')
  }

  const filteredMedia = selectedCategory === 'all'
    ? mediaLibrary
    : mediaLibrary.filter(m => m.category === selectedCategory || m.type === selectedCategory)

  const roleParam = (params?.role || '').toUpperCase()
  const isPrime = params?.isPrime === true
  const isPlayerView = currentView === 'player' && selectedMedia

  if (isPlayerView) {
    return (
      <div className="app player">
        <VideoPlayer
          media={selectedMedia}
          onClose={handleClosePlayer}
          radioNowPlaying={radioNowPlaying}
          onRadioToggle={() => setIsRadioExpanded(!isRadioExpanded)}
        />
        {radioNowPlaying && (
          <MiniRadioPlayer
            nowPlaying={radioNowPlaying}
            isExpanded={isRadioExpanded}
            onToggle={() => setIsRadioExpanded(!isRadioExpanded)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="app home">
      <Header
        title="PNPtv Live"
        subtitle="Your Media Center"
        telegramUser={telegramUser}
        onLogout={handleLogout}
        loginRef={loginRef}
      />

      <section className="hero-banner">
        <div className="hero-copy">
          <p className="hero-eyebrow">Live Streaming Platform</p>
          <h2>Experience live events, shows, and more.</h2>
          <p>
            Join live streams, interact with creators, and enjoy exclusive content. 
            All powered by PNPtv.
          </p>
          <div className="hero-badges">
            <span className="hero-badge">Live Events</span>
            <span className="hero-badge">Creator Streams</span>
            <span className="hero-badge">24/7 Radio</span>
          </div>
        </div>
        <div className="hero-panel">
          
          <p className="hero-panel-title">Radio status</p>
          <div className="hero-panel-row">
            <span>{radioNowPlaying ? 'Live now' : 'Offline'}</span>
            <span className={`status-dot ${radioNowPlaying ? 'live' : ''}`}></span>
          </div>
          <p className="hero-panel-track">
            {radioNowPlaying?.title || 'Check back soon for the live mix.'}
          </p>
          {radioNowPlaying && (
            <button type="button" className="hero-panel-btn" onClick={() => setIsRadioExpanded(true)}>
              Open radio
            </button>
          )}
        </div>
      </section>

      <CategoryNav
        selected={selectedCategory}
        onChange={handleCategoryChange}
        radioActive={radioNowPlaying !== null}
      />

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading media...</p>
        </div>
      ) : (
        <MediaGrid
          media={filteredMedia}
          onSelect={handleMediaSelect}
        />
      )}

      

      {radioNowPlaying && (
        <MiniRadioPlayer
          nowPlaying={radioNowPlaying}
          isExpanded={isRadioExpanded}
          onToggle={() => setIsRadioExpanded(!isRadioExpanded)}
        />
      )}
    </div>
  )
}

export default App