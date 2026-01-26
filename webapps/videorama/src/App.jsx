import { useState, useEffect } from 'react'
import Header from './components/Header'
import MediaGrid from './components/MediaGrid'
import VideoPlayer from './components/VideoPlayer'
import MiniRadioPlayer from './components/MiniRadioPlayer'
import CategoryNav from './components/CategoryNav'
import { getUrlParams, fetchMediaLibrary, fetchRadioNowPlaying } from './utils/api'

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

  useEffect(() => {
    const urlParams = getUrlParams()
    setParams(urlParams)
    setCurrentView(urlParams.view || 'home')

    loadMedia()
    loadRadioStatus()

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

  function handleClosePlayer() {
    setSelectedMedia(null)
    setCurrentView('home')
  }

  const filteredMedia = selectedCategory === 'all'
    ? mediaLibrary
    : mediaLibrary.filter(m => m.category === selectedCategory || m.type === selectedCategory)

  if (currentView === 'player' && selectedMedia) {
    return (
      <div className="app">
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
    <div className="app">
      <Header
        title="PNPtv Videorama"
        subtitle="Your Media Center"
      />

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
