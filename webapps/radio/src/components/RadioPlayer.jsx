import { useState, useEffect, useRef } from 'react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

const RadioPlayer = ({ room, token, uid, username, appId }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(50)
  const [isMuted, setIsMuted] = useState(false)
  const [nowPlaying, setNowPlaying] = useState({
    title: 'Loading...',
    artist: 'PNPtv Radio',
  })
  const [listeners, setListeners] = useState(0)
  const [error, setError] = useState(null)

  const clientRef = useRef(null)
  const audioTrackRef = useRef(null)

  useEffect(() => {
    // Initialize Agora client for audio-only streaming
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
    client.setClientRole('audience')
    clientRef.current = client

    const init = async () => {
      try {
        // Join the channel
        await client.join(
          appId || 'b68ab7b61ea44eabab7f242171311c5e',
          room || 'pnptv_radio',
          token,
          uid
        )

        // Listen for remote audio
        client.on('user-published', async (user, mediaType) => {
          if (mediaType === 'audio') {
            await client.subscribe(user, mediaType)
            audioTrackRef.current = user.audioTrack
            user.audioTrack.play()
            setIsPlaying(true)
          }
        })

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'audio') {
            setIsPlaying(false)
          }
        })

        // Update listener count
        client.on('user-joined', () => {
          setListeners((prev) => prev + 1)
        })

        client.on('user-left', () => {
          setListeners((prev) => Math.max(0, prev - 1))
        })

      } catch (err) {
        console.error('Failed to join radio stream:', err)
        setError(err.message)
      }
    }

    init()

    // Cleanup
    return () => {
      if (clientRef.current) {
        clientRef.current.leave()
      }
    }
  }, [])

  useEffect(() => {
    // Adjust volume
    if (audioTrackRef.current) {
      audioTrackRef.current.setVolume(isMuted ? 0 : volume)
    }
  }, [volume, isMuted])

  const togglePlay = () => {
    if (audioTrackRef.current) {
      if (isPlaying) {
        audioTrackRef.current.stop()
        setIsPlaying(false)
      } else {
        audioTrackRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  if (error) {
    return (
      <div className="loading">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="radio-container">
      <div className="radio-header">
        <h1>🎵 PNPtv Radio</h1>
        <span className="live-badge">● LIVE</span>
      </div>

      <div className="now-playing">
        <h3>Now Playing</h3>
        <div className="track-info">{nowPlaying.title}</div>
        <div className="artist-info">{nowPlaying.artist}</div>
      </div>

      <div className="player-controls">
        <button className="play-button" onClick={togglePlay}>
          {isPlaying ? <Pause size={32} /> : <Play size={32} />}
        </button>

        <div className="volume-control">
          <button
            onClick={toggleMute}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="volume-slider"
          />
        </div>
      </div>

      <div className="stats">
        <div className="stat-item">
          <div className="stat-value">{listeners}</div>
          <div className="stat-label">Listeners</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">24/7</div>
          <div className="stat-label">Live</div>
        </div>
      </div>
    </div>
  )
}

export default RadioPlayer
