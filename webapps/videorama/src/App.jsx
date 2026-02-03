import { useState, useEffect } from 'react'
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

  useEffect(() => {
    const urlParams = getUrlParams()
    setParams(urlParams)
    setCurrentView(urlParams.view || 'home')

    loadMedia()
    loadRadioStatus()
    loadCollections()

    // Refresh radio status periodically
    const radioInterval = setInterval(loadRadioStatus, 30000)
    return () => clearInterval(radioInterval)
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
      loadMedia()
    } else if (category === 'radio') {
      setIsRadioExpanded(true)
    } else {
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

  const filteredMedia = selectedCategory === 'all'
    ? mediaLibrary
    : mediaLibrary.filter(m => m.category === selectedCategory || m.type === selectedCategory)

  const roleParam = (params?.role || '').toUpperCase()
  const canManageCollections = roleParam === 'PRIME' || roleParam === 'ADMIN'
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
        title="PNPtv Videorama"
        subtitle="Your Media Center"
      />

      <section className="hero-banner">
        <div className="hero-copy">
          <p className="hero-eyebrow">Curated media feed</p>
          <h2>Video drops, podcasts, and radio — all in one place.</h2>
          <p>
            Browse categories or jump into a collection. New uploads and PRIME content are synced
            to your membership automatically.
          </p>
          <div className="hero-badges">
            <span className="hero-badge">Fresh drops</span>
            <span className="hero-badge">Community picks</span>
            <span className="hero-badge">Live radio</span>
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

      {collections.length > 0 && (
        <section className="collections-section">
          <div className="collections-header">
            <div>
              <h2>Collections</h2>
              <p>Curated playlists and podcasts powered by Videorama.</p>
            </div>
            {canManageCollections && (
              <a href="https://pnptv.app/videorama/create" target="_blank" rel="noreferrer" className="create-link">
                + Create collection
              </a>
            )}
          </div>
          {collectionsLoading ? (
            <p>Loading collections...</p>
          ) : (
            <>
              {collections.length > 0 ? (
                <div className="collection-grid">
                  {collections.map((collection) => (
                    <article key={collection.id} className="collection-card">
                      <div className="collection-title">{collection.title}</div>
                      <p className="collection-desc">{collection.description}</p>
                      <div className="collection-meta">
                        <span>{collection.visibility} collection</span>
                        <button type="button" onClick={() => handleCollectionSelect(collection)}>
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
          {error && <p className="error-text">{error}</p>}
        </section>
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
