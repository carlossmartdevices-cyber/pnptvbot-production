import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Radio, Music, Clock, Users, Send, ListMusic } from 'lucide-react'
import { fetchRadioHistory, requestRadioSong, fetchRadioQueue, fetchRadioNowPlaying, fetchRadioRequests } from '../utils/api'

export default function RadioPage({ nowPlaying: initialNowPlaying, telegramUser, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [nowPlaying, setNowPlaying] = useState(initialNowPlaying)
  const [listenerCount, setListenerCount] = useState(initialNowPlaying?.listenerCount || 0)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [queue, setQueue] = useState([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [activeTab, setActiveTab] = useState('history') // history, queue, requests
  const [requestForm, setRequestForm] = useState({ songName: '', artist: '' })
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)

  const audioRef = useRef(null)
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    loadHistory()
    loadQueue()
    loadRequests()

    // Poll for live listener count and now playing updates
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await fetchRadioNowPlaying()
        if (data) {
          setNowPlaying(data)
          setListenerCount(data.listenerCount || 0)
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 5000) // Update every 5 seconds

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  async function loadHistory() {
    setHistoryLoading(true)
    const data = await fetchRadioHistory(20)
    setHistory(Array.isArray(data) ? data : [])
    setHistoryLoading(false)
  }

  async function loadQueue() {
    setQueueLoading(true)
    const data = await fetchRadioQueue()
    setQueue(Array.isArray(data) ? data : [])
    setQueueLoading(false)
  }

  async function loadRequests() {
    const data = await fetchRadioRequests('pending')
    setRequests(Array.isArray(data) ? data : [])
  }

  function togglePlay() {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  function toggleMute() {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  function handleVolumeChange(e) {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }

  async function handleSongRequest(e) {
    e.preventDefault()
    if (!requestForm.songName.trim()) return

    setRequestLoading(true)
    try {
      await requestRadioSong(
        telegramUser?.id || 'anonymous',
        requestForm.songName,
        requestForm.artist || ''
      )
      setRequestSuccess(true)
      setRequestForm({ songName: '', artist: '' })
      setTimeout(() => setRequestSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to submit request:', error)
    } finally {
      setRequestLoading(false)
    }
  }

  const track = nowPlaying?.track || {}

  return (
    <div className="radio-page">
      {/* Close button */}
      <button className="radio-close-btn" onClick={onClose}>
        ← Back
      </button>

      {/* Radio Player Card */}
      <div className="radio-main-card">
        <div className="radio-header">
          <div className="radio-icon-large">
            <Radio size={48} />
          </div>
          <div className="radio-station-info">
            <h1>PNPtv Radio</h1>
            <p className="radio-tagline">Live 24/7 Latin Music & Podcasts</p>
          </div>
        </div>

        {/* Now Playing Section */}
        <div className="radio-now-playing-section">
          <div className="now-playing-display">
            {track.thumbnailUrl ? (
              <img src={track.thumbnailUrl} alt={track.title} className="radio-album-art" />
            ) : (
              <div className="radio-album-placeholder">
                <Music size={48} />
              </div>
            )}
          </div>

          <div className="radio-track-info">
            <div className="track-label">Now Playing</div>
            <h2 className="track-title">{track.title || 'PNPtv Radio'}</h2>
            <p className="track-artist">{track.artist || 'Starting Soon'}</p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="radio-controls-large">
          <button
            className={`radio-play-btn-large ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={32} /> : <Play size={32} fill="white" />}
          </button>

          <div className="radio-volume-control">
            <button className="volume-btn" onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="volume-slider-large"
            />
            <span className="volume-value">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="radio-stats-large">
          <div className="stat">
            <Users size={20} />
            <span>{listenerCount}</span>
            <span className="stat-label">Listeners</span>
          </div>
          <div className="stat live">
            <div className="live-badge">● LIVE</div>
            <span className="stat-label">24/7</span>
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src="/api/radio/stream"
          onEnded={() => setIsPlaying(false)}
        />
      </div>

      {/* Song Request Card */}
      <div className="radio-request-card">
        <h3>Request a Song</h3>
        <form onSubmit={handleSongRequest} className="request-form">
          <input
            type="text"
            placeholder="Song name *"
            value={requestForm.songName}
            onChange={(e) => setRequestForm({ ...requestForm, songName: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Artist"
            value={requestForm.artist}
            onChange={(e) => setRequestForm({ ...requestForm, artist: e.target.value })}
          />
          <button type="submit" disabled={requestLoading || !requestForm.songName.trim()}>
            <Send size={18} />
            {requestLoading ? 'Sending...' : 'Request'}
          </button>
        </form>
        {requestSuccess && (
          <div className="request-success">✓ Request submitted! Thanks for listening.</div>
        )}
      </div>

      {/* Tabs */}
      <div className="radio-tabs-container">
        <div className="radio-tabs">
          <button
            className={`radio-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} />
            History
          </button>
          <button
            className={`radio-tab ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <ListMusic size={16} />
            Next Up ({queue.length})
          </button>
          <button
            className={`radio-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <Music size={16} />
            Requests ({requests.length})
          </button>
        </div>

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="radio-tab-content">
            {historyLoading ? (
              <div className="history-loading">Loading...</div>
            ) : history.length > 0 ? (
              <div className="history-list">
                {history.map((item, idx) => (
                  <div key={idx} className="history-item">
                    <div className="history-info">
                      <div className="history-track">{item.title || 'Unknown'}</div>
                      <div className="history-artist">{item.artist || 'Unknown'}</div>
                    </div>
                    <div className="history-time">
                      {item.played_at ? new Date(item.played_at).toLocaleTimeString() : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-empty">No history yet. Start playing!</div>
            )}
          </div>
        )}

        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div className="radio-tab-content">
            {queueLoading ? (
              <div className="queue-loading">Loading queue...</div>
            ) : queue.length > 0 ? (
              <div className="queue-list">
                {queue.map((item, idx) => (
                  <div key={item.id || idx} className="queue-item">
                    <div className="queue-position">{idx + 1}</div>
                    <div className="queue-info">
                      <div className="queue-track">{item.title || 'Unknown'}</div>
                      <div className="queue-artist">{item.artist || 'Unknown'}</div>
                    </div>
                    <div className="queue-duration">
                      {item.duration ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="queue-empty">Queue is empty. Submit a request!</div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="radio-tab-content">
            {requests.length > 0 ? (
              <div className="requests-list">
                {requests.map((item) => (
                  <div key={item.id} className="request-item">
                    <div className="request-info">
                      <div className="request-song">{item.song_name || 'Unknown'}</div>
                      <div className="request-artist">{item.artist || 'Unknown Artist'}</div>
                      <div className="request-user">by {item.user_id}</div>
                    </div>
                    <div className="request-status">
                      <span className={`status-badge ${item.status}`}>{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="requests-empty">No pending requests</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
