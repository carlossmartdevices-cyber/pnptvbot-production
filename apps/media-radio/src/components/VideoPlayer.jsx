import { useState, useRef, useEffect } from 'react'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Radio, ChevronDown
} from 'lucide-react'

export default function VideoPlayer({ media, onClose, radioNowPlaying, onRadioToggle }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)

  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimeout = useRef(null)

  const isVideo = media.type === 'video'
  const isAudio = media.type === 'audio' || media.type === 'podcast'

  useEffect(() => {
    if (videoRef.current && media.url) {
      videoRef.current.load()
    }
  }, [media])

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true)
      clearTimeout(controlsTimeout.current)
      controlsTimeout.current = setTimeout(() => {
        if (isPlaying) setShowControls(false)
      }, 3000)
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(controlsTimeout.current)
    }
  }, [isPlaying])

  function togglePlay() {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleTimeUpdate() {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  function handleLoadedMetadata() {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  function handleSeek(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const time = percent * duration

    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  function handleVolumeChange(e) {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setIsMuted(newVolume === 0)
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  function skip(seconds) {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds))
    }
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`video-player-container ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
      {/* Close button */}
      <button className="player-close-btn" onClick={onClose}>
        <X size={24} />
      </button>

      {/* Media display */}
      <div className="player-media">
        {isVideo && media.url ? (
          <video
            ref={videoRef}
            className="video-element"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
          >
            <source src={media.url} type="video/mp4" />
          </video>
        ) : (
          <div className="audio-display">
            {media.cover_url ? (
              <img src={media.cover_url} alt={media.title} className="audio-cover" />
            ) : (
              <div className="audio-placeholder">
                <Play size={64} />
              </div>
            )}
            {isAudio && media.url && (
              <audio
                ref={videoRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
              >
                <source src={media.url} type="audio/mpeg" />
              </audio>
            )}
          </div>
        )}

        {/* Overlay when paused */}
        {!isPlaying && (
          <div className="player-overlay" onClick={togglePlay}>
            <button className="big-play-btn">
              <Play size={48} fill="white" />
            </button>
          </div>
        )}
      </div>

      {/* Media info */}
      <div className="player-info">
        <h2>{media.title}</h2>
        <p>{media.artist || 'Unknown Artist'}</p>
      </div>

      {/* Controls */}
      <div className={`player-controls ${showControls ? 'visible' : ''}`}>
        {/* Progress bar */}
        <div className="progress-container" onClick={handleSeek}>
          <div className="progress-bar">
            <div className="progress-filled" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="controls-row">
          <div className="controls-left">
            <button onClick={() => skip(-10)} title="Rewind 10s">
              <SkipBack size={20} />
            </button>
            <button className="play-pause-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={28} /> : <Play size={28} fill="white" />}
            </button>
            <button onClick={() => skip(10)} title="Forward 10s">
              <SkipForward size={20} />
            </button>
          </div>

          <div className="controls-center">
            {radioNowPlaying && (
              <button className="radio-switch-btn" onClick={onRadioToggle}>
                <Radio size={18} />
                <span>Radio</span>
              </button>
            )}
          </div>

          <div className="controls-right">
            <div className="volume-control">
              <button onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>
            {isVideo && (
              <button onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
