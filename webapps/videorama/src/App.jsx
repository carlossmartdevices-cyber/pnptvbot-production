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
  fetchCollections,
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
  const [collections, setCollections] = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [telegramUser, setTelegramUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true) // Set to true initially
  const [isAuthenticated, setIsAuthenticated] = useState(false) // New state
  const loginRef = useRef(null)

  useEffect(() => {
    const urlParams = getUrlParams()
    setParams(urlParams)
    setCurrentView(urlParams.view || 'home')

    const initializeUser = async () => {
      setAuthLoading(true);
      try {
        const currentUser = await fetchTelegramUser();
        if (currentUser) {
          setTelegramUser(currentUser);
          setIsAuthenticated(true);
          // Only load media/radio/collections if authenticated
          loadMedia();
          loadRadioStatus();
          loadCollections();
        } else {
          setIsAuthenticated(false);
          // initTelegramLogin(loginRef); // No need to initialize here, LoginPage will do it
        }
      } catch (err) {
        setError(err.message);
        setIsAuthenticated(false);
        // initTelegramLogin(loginRef); // No need to initialize here, LoginPage will do it
      } finally {
        setAuthLoading(false);
      }
    };

    initializeUser();

    // Setup Telegram auth callback
    window.onTelegramAuth = async (user) => {
      await handleTelegramAuth(user, setTelegramUser, setAuthLoading, setError);
      setIsAuthenticated(true); // Set authenticated on successful login
      loadMedia(); // Load content after successful login
      loadRadioStatus();
      loadCollections();
    };
    
    // Refresh radio status periodically
    const radioInterval = setInterval(loadRadioStatus, 30000);
    
    return () => {
      clearInterval(radioInterval);
    }
  }, [isAuthenticated]); // Depend on isAuthenticated to re-run effects

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

  async function loadCollections() {
    setCollectionsLoading(true)
    try {
      const data = await fetchCollections()
      setCollections(data)
      setError(null)
    } catch (error) {
      console.error('Failed to load collections:', error)
      setError('Could not load collections at the moment.')
      setCollections([])
    } finally {
      setCollectionsLoading(false)
    }
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
      setCurrentView('home')
      loadMedia()
    } else if (category === 'radio') {
      setCurrentView('radio')
    } else {
      setCurrentView('home')
      loadMedia(category)
    }
  }

  function handleCollectionSelect(collection) {
    if (collection.items && collection.items.length > 0) {
      setSelectedMedia({
        id: collection.items[0].id || collection.id,
        title: collection.items[0].title || collection.title,
        artist: collection.items[0].artist || 'PNPtv',
        type: 'video',
        duration: collection.items[0].duration || 0,
        cover_url: collection.items[0].cover_url || collection.cover_url || 'https://picsum.photos/seed/pnp-collection/400/225',
        url: collection.items[0].url || collection.items[0].path,
      })
      setCurrentView('player')
    } else {
      window.open(`https://pnptv.app/videorama/${collection.id}`, '_blank')
    }
  }

  function handleMediaSelect(media) {
    setSelectedMedia(media)
    setCurrentView('player')
  }

  function handleClosePlayer() {
    setSelectedMedia(null)
    setCurrentView('home')
  }

  function handleFeaturedNavigation(type) {
    setCurrentView('home')
    switch (type) {
      case 'videorama':
        setSelectedCategory('videos')
        loadMedia('videos')
        break
      case 'live':
        window.location.href = '/app/live'
        break
      case 'hangout':
        window.location.href = '/app/hangouts'
        break
      default:
        setSelectedCategory('all')
        loadMedia()
    }
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

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="spinner-lg"></div>
        <p className="text-muted-foreground mt-4">Loading authentication...</p>
      </div>
    );
  }

  // Videorama is publicly accessible - no login required
  // Authenticated users see personalized content, unauthenticated see public content

  const isPrime = params?.isPrime === true
  // Allow collection management for ADMIN, SUPERADMIN, PERFORMER, or PRIME subscribers
  const canManageCollections = ['ADMIN', 'SUPERADMIN', 'PERFORMER'].includes(telegramUser?.subscriptionStatus?.toUpperCase()) || isPrime
  const isPlayerView = currentView === 'player' && selectedMedia

  // Get user tier from telegramUser (default to 'free')
  const userTier = telegramUser?.tier || 'free'

  // Filter media by selected category
  const filteredMedia = selectedCategory === 'all' || selectedCategory === 'radio'
    ? mediaLibrary
    : mediaLibrary.filter(media => media.category === selectedCategory)

  if (isPlayerView) {
    return (
      <>
        <VideoPlayer
          media={selectedMedia}
          onClose={handleClosePlayer}
          radioNowPlaying={radioNowPlaying}
          onRadioToggle={() => setIsRadioExpanded(!isRadioExpanded)}
          userTier={userTier}
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

  if (currentView === 'radio' && radioNowPlaying) {
    return (
      <RadioPage
        nowPlaying={radioNowPlaying}
        telegramUser={telegramUser}
        onClose={() => {
          setCurrentView('home')
          setSelectedCategory('all')
        }}
      />
    )
  }

  return (
    <>
      <Header
        title="PNPtv Videorama"
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

        {collections.length > 0 && (
          <section className="collections-section">
            <div className="collections-header">
              <h2>Collections</h2>
              {canManageCollections && (
                <a href="https://pnptv.app/videorama/create" target="_blank" rel="noreferrer" className="button button-primary">
                  + Create collection
                </a>
              )}
            </div>
            {collectionsLoading ? (
              <p>Loading collections...</p>
            ) : (
              <>
                {collections.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {collections.map((collection) => (
                      <article key={collection.id} className="card">
                        <div className="text-lg font-semibold">{collection.title}</div>
                        <p className="text-muted-foreground text-sm">{collection.description}</p>
                        <div className="flex justify-between items-center mt-4">
                          <span>{collection.visibility} collection</span>
                          <button type="button" className="button button-sm" onClick={() => handleCollectionSelect(collection)}>
                            View details
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>No collections are available right now.</p>
                )}
              </>
            )}
            {error && <p className="alert alert-error">{error}</p>}
          </section>
        )}

        {radioNowPlaying && (
          <MiniRadioPlayer
            nowPlaying={radioNowPlaying}
            isExpanded={isRadioExpanded}
            onToggle={() => setIsRadioExpanded(!isRadioExpanded)}
          />
        )}

        {/* Featured Content Collage */}
        <FeaturedContent onNavigate={handleFeaturedNavigation} />
      </main>
    </>
  )
}

export default App