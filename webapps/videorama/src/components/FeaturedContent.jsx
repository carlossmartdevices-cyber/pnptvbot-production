import { useState, useEffect } from 'react'
import { Crown, Film, Radio, Users, Play, Lock } from 'lucide-react'
import {
  fetchLatestPrimeVideo,
  fetchLatestVideoramaVideo,
  fetchActiveLiveStreams,
  fetchMostActiveHangout,
} from '../utils/api'

export default function FeaturedContent({ onNavigate }) {
  const [primeVideo, setPrimeVideo] = useState(null)
  const [videoramaVideo, setVideoramaVideo] = useState(null)
  const [liveStream, setLiveStream] = useState(null)
  const [hangout, setHangout] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFeaturedContent()
  }, [])

  async function loadFeaturedContent() {
    setLoading(true)
    try {
      // Use Promise.allSettled to allow individual failures
      const results = await Promise.allSettled([
        fetchLatestPrimeVideo(),
        fetchLatestVideoramaVideo(),
        fetchActiveLiveStreams(),
        fetchMostActiveHangout(),
      ])

      // Extract values, handling both fulfilled and rejected states
      const [primeResult, videoramaResult, liveResult, hangoutResult] = results

      setPrimeVideo(primeResult.status === 'fulfilled' ? primeResult.value : null)
      setVideoramaVideo(videoramaResult.status === 'fulfilled' ? videoramaResult.value : null)
      setLiveStream(liveResult.status === 'fulfilled' ? liveResult.value : null)
      setHangout(hangoutResult.status === 'fulfilled' ? hangoutResult.value : null)
    } catch (err) {
      console.error('Error loading featured content:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="featured-content">
        <div className="featured-loading">Loading featured content...</div>
      </div>
    )
  }

  // Count available content
  const hasContent = primeVideo || videoramaVideo || liveStream || hangout

  // Don't show featured section if no content is available
  if (!hasContent) {
    return null
  }

  return (
    <div className="featured-content">
      <h3 className="featured-title">Featured Content</h3>

      <div className="featured-grid">
        {/* Prime Video - Only show if available */}
        {primeVideo && (
          <div className="featured-card prime-card">
            <div className="featured-badge">
              <Crown size={16} />
              PRIME
            </div>
            <div className="featured-image">
              {primeVideo?.cover_url ? (
                <img src={primeVideo.cover_url} alt={primeVideo.title} />
              ) : (
                <div className="featured-placeholder">
                  <Lock size={40} />
                </div>
              )}
              <div className="featured-overlay">
                <button className="featured-btn" onClick={() => onNavigate?.('prime')}>
                  <Play size={20} fill="white" />
                  Subscribe
                </button>
              </div>
            </div>
            <div className="featured-info">
              <div className="featured-label">Latest Prime Video</div>
              <h4 className="featured-name">{primeVideo?.title || 'Premium Content'}</h4>
              <p className="featured-meta">{primeVideo?.artist || 'Exclusive'}</p>
            </div>
          </div>
        )}

        {/* Videorama Video - Only show if available */}
        {videoramaVideo && (
          <div className="featured-card videorama-card">
            <div className="featured-badge">
              <Film size={16} />
              VIDEORAMA
            </div>
            <div className="featured-image">
              {videoramaVideo?.cover_url ? (
                <img src={videoramaVideo.cover_url} alt={videoramaVideo.title} />
              ) : (
                <div className="featured-placeholder">
                  <Film size={40} />
                </div>
              )}
              <div className="featured-overlay">
                <button className="featured-btn" onClick={() => onNavigate?.('videorama')}>
                  <Play size={20} fill="white" />
                  Watch
                </button>
              </div>
            </div>
            <div className="featured-info">
              <div className="featured-label">Latest Video</div>
              <h4 className="featured-name">{videoramaVideo?.title || 'New Video'}</h4>
              <p className="featured-meta">{videoramaVideo?.artist || 'Videorama'}</p>
            </div>
          </div>
        )}

        {/* Live Stream - Only show if available */}
        {liveStream && (
          <div className="featured-card live-card">
            <div className="featured-badge live">
              <Radio size={16} />
              LIVE
            </div>
            <div className="featured-image">
              {liveStream?.thumbnail ? (
                <img src={liveStream.thumbnail} alt={liveStream.title} />
              ) : (
                <div className="featured-placeholder">
                  <Radio size={40} />
                </div>
              )}
              <div className="featured-overlay">
                <button className="featured-btn" onClick={() => onNavigate?.('live')}>
                  <Play size={20} fill="white" />
                  Join
                </button>
              </div>
            </div>
            <div className="featured-info">
              <div className="featured-label">Live Stream</div>
              <h4 className="featured-name">{liveStream?.title || 'Live Now'}</h4>
              <p className="featured-meta">{liveStream?.host || 'Host'}</p>
            </div>
          </div>
        )}

        {/* Most Active Hangout - Only show if available */}
        {hangout && (
          <div className="featured-card hangout-card">
            <div className="featured-badge hangout">
              <Users size={16} />
              HANGOUT
            </div>
            <div className="featured-image">
              {hangout?.thumbnail ? (
                <img src={hangout.thumbnail} alt={hangout.title} />
              ) : (
                <div className="featured-placeholder">
                  <Users size={40} />
                </div>
              )}
              <div className="featured-overlay">
                <button className="featured-btn" onClick={() => onNavigate?.('hangout')}>
                  <Play size={20} fill="white" />
                  Join
                </button>
              </div>
            </div>
            <div className="featured-info">
              <div className="featured-label">Most Active</div>
              <h4 className="featured-name">{hangout?.title || 'Join Community'}</h4>
              <p className="featured-meta">{hangout?.members_count || 0} members</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
