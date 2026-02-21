import { useState, useRef, useEffect } from 'react'
import { Radio, Play, Pause, Volume2, VolumeX } from 'lucide-react'

export default function RadioPlayer({ nowPlaying }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef(null)

  // When isPlaying changes, play/pause audio
  useEffect(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.play().catch(err => console.error('Failed to play audio:', err))
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying])

  // When muted changes, apply to audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted
    }
  }, [isMuted])

  if (!nowPlaying) {
    return (
      <div className="radio-player-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading PNPtv Radio...</p>
        </div>
      </div>
    )
  }

  const track = nowPlaying.track || {}
  const listenerCount = nowPlaying.listenerCount || 0

  return (
    <div className="radio-player-container">
      <div className="radio-now-playing">
        {track.thumbnailUrl ? (
          <img src={track.thumbnailUrl} alt={track.title} className="radio-thumb" />
        ) : (
          <div className="radio-thumb-placeholder">
            <Radio size={64} />
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
          {isPlaying ? <Pause size={32} /> : <Play size={32} fill="white" />}
        </button>

        <button
          className="radio-mute-btn"
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
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

      {/* Hidden audio element for streaming */}
      <audio ref={audioRef} src="/api/radio/stream" preload="none" crossOrigin="anonymous" />
    </div>
  )
}
