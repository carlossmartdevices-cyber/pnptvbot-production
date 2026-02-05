import { useState } from 'react'
import { Radio, Play, Pause, ChevronUp, ChevronDown, Volume2, VolumeX, ExternalLink } from 'lucide-react'

export default function MiniRadioPlayer({ nowPlaying, isExpanded, onToggle }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  if (!nowPlaying) return null

  const track = nowPlaying.track || {}
  const listenerCount = nowPlaying.listenerCount || 0

  function openRadioApp() {
    // Open the full radio app
    const radioUrl = window.location.origin + '/radio/'
    window.open(radioUrl, '_blank')
  }

  return (
    <div className={`mini-radio-player ${isExpanded ? 'expanded' : ''}`}>
      {/* Collapsed view */}
      <div className="mini-radio-bar" onClick={onToggle}>
        <div className="mini-radio-info">
          <div className="radio-icon-pulse">
            <Radio size={16} />
          </div>
          <div className="mini-track-info">
            <span className="mini-track-title">{track.title || 'PNPtv Radio'}</span>
            <span className="mini-track-artist">{track.artist || 'Live 24/7'}</span>
          </div>
        </div>
        <div className="mini-radio-actions">
          <button
            className="mini-play-btn"
            onClick={(e) => {
              e.stopPropagation()
              setIsPlaying(!isPlaying)
            }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} fill="white" />}
          </button>
          {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </div>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div className="mini-radio-expanded">
          <div className="radio-now-playing">
            {track.thumbnailUrl ? (
              <img src={track.thumbnailUrl} alt={track.title} className="radio-thumb" />
            ) : (
              <div className="radio-thumb-placeholder">
                <Radio size={32} />
              </div>
            )}
            <div className="radio-track-details">
              <h4>Now Playing</h4>
              <p className="radio-track-title">{track.title || 'Unknown Track'}</p>
              <p className="radio-track-artist">{track.artist || 'Unknown Artist'}</p>
            </div>
          </div>

          <div className="radio-controls">
            <button
              className={`radio-play-btn ${isPlaying ? 'playing' : ''}`}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} fill="white" />}
            </button>

            <button
              className="radio-mute-btn"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>

          <div className="radio-stats">
            <div className="stat">
              <span className="stat-value">{listenerCount}</span>
              <span className="stat-label">Listeners</span>
            </div>
            <div className="stat">
              <span className="stat-value live-badge">LIVE</span>
              <span className="stat-label">24/7</span>
            </div>
          </div>

          <button className="open-radio-btn" onClick={openRadioApp}>
            <ExternalLink size={16} />
            <span>Open Full Player</span>
          </button>
        </div>
      )}
    </div>
  )
}
