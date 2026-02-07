import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import MediaGrid from './components/MediaGrid'
import VideoPlayer from './components/VideoPlayer'
import MiniRadioPlayer from './components/MiniRadioPlayer'
import CategoryNav from './components/CategoryNav'
import LoginPage from './components/LoginPage' // Import LoginPage
import {
  getUrlParams,
  fetchMediaLibrary,
  fetchRadioNowPlaying,
  fetchTelegramUser,
  initTelegramLogin,
  handleTelegramAuth,
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
  const [authLoading, setAuthLoading] = useState(true) // Set to true initially
  const [isAuthenticated, setIsAuthenticated] = useState(false) // New state
  const loginRef = useRef(null)

  useEffect(() => {
    const urlParams = getUrlParams()
    setParams(urlParams)
    setCurrentView(urlParams.view || 'home')

    // Initial Telegram auth check
    const initializeUser = async () => {
      setAuthLoading(true)
      try {
        const currentUser = await fetchTelegramUser()
        if (currentUser) {
          setTelegramUser(currentUser)
          setIsAuthenticated(true)
          // Only load media/radio/collections if authenticated
          loadMedia()
          loadRadioStatus()
        } else {
          setIsAuthenticated(false)
        }
      } catch (err) {
        setError(err.message)
        setIsAuthenticated(false)
      } finally {
        setAuthLoading(false)
      }
    }

    initializeUser()

    // Setup Telegram auth callback
    window.onTelegramAuth = async (user) => {
      await handleTelegramAuth(user, setTelegramUser, setAuthLoading, setError);
      setIsAuthenticated(true); // Set authenticated on successful login
      loadMedia(); // Load content after successful login
      loadRadioStatus();
    };

    // Refresh radio status periodically
    const radioInterval = setInterval(loadRadioStatus, 30000);

    return () => {
      clearInterval(radioInterval)
    }
  }, [isAuthenticated]) // Re-run effect when authentication status changes

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

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setTelegramUser(null);
      setIsAuthenticated(false); // Reset authenticated on logout
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to log out.');
    }
  };

  function handleClosePlayer() {
    setSelectedMedia(null);
    setCurrentView('home');
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="spinner-lg"></div>
        <p className="text-muted-foreground mt-4">Loading authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onAuthSuccess={() => setIsAuthenticated(true)} authLoading={authLoading} />;
  }

  const isPlayerView = currentView === 'player' && selectedMedia

  if (isPlayerView) {
    return (
      <>
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
      </>
    )
  }

  return (
    <>
      <Header
        title="PNPtv Live"
        telegramUser={telegramUser}
        onLogout={handleLogout}
      />

      <main className="container">
        <CategoryNav
          selected={selectedCategory}
          onChange={handleCategoryChange}
          radioActive={radioNowPlaying !== null}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <div className="spinner-lg"></div>
            <p className="text-muted-foreground mt-4">Loading media...</p>
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
      </main>
    </>
  )
}

export default App