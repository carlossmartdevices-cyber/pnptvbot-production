import { useState, useEffect, useRef } from 'react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Eye, MessageCircle } from 'lucide-react'

const LiveStream = ({ stream, token, uid, username, role, appId }) => {
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null })
  const [isLive, setIsLive] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [showChat, setShowChat] = useState(true)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [error, setError] = useState(null)

  const clientRef = useRef(null)
  const isHost = role === 'host'

  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
    clientRef.current = client

    const init = async () => {
      try {
        // Set client role
        await client.setClientRole(isHost ? 'host' : 'audience')

        // Join channel
        await client.join(
          appId || 'b68ab7b61ea44eabab7f242171311c5e',
          stream,
          token,
          uid
        )

        // If host, create and publish tracks
        if (isHost) {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
          setLocalTracks({ audio: audioTrack, video: videoTrack })

          // Publish tracks
          await client.publish([audioTrack, videoTrack])

          // Play local video
          videoTrack.play('stream-player')

          setIsLive(true)
        } else {
          // If viewer, subscribe to host
          client.on('user-published', async (user, mediaType) => {
            await client.subscribe(user, mediaType)

            if (mediaType === 'video') {
              user.videoTrack.play('stream-player')
              setIsLive(true)
            }

            if (mediaType === 'audio') {
              user.audioTrack.play()
            }
          })
        }

        // Track viewer count
        client.on('user-joined', () => {
          setViewerCount((prev) => prev + 1)
        })

        client.on('user-left', () => {
          setViewerCount((prev) => Math.max(0, prev - 1))
        })

      } catch (err) {
        console.error('Failed to join live stream:', err)
        setError(err.message)
      }
    }

    init()

    return () => {
      if (localTracks.audio) {
        localTracks.audio.stop()
        localTracks.audio.close()
      }
      if (localTracks.video) {
        localTracks.video.stop()
        localTracks.video.close()
      }
      if (clientRef.current) {
        clientRef.current.leave()
      }
    }
  }, [])

  const toggleAudio = async () => {
    if (localTracks.audio && isHost) {
      await localTracks.audio.setEnabled(!isAudioEnabled)
      setIsAudioEnabled(!isAudioEnabled)
    }
  }

  const toggleVideo = async () => {
    if (localTracks.video && isHost) {
      await localTracks.video.setEnabled(!isVideoEnabled)
      setIsVideoEnabled(!isVideoEnabled)
    }
  }

  const endStream = async () => {
    if (clientRef.current) {
      await clientRef.current.leave()
    }
    window.close()
  }

  const sendMessage = () => {
    if (messageInput.trim()) {
      setMessages((prev) => [
        ...prev,
        { username, text: messageInput, timestamp: Date.now() },
      ])
      setMessageInput('')
    }
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
    <div className="live-container">
      <div className="stream-header">
        <div>
          <span className="live-badge">● LIVE</span>
          <span style={{ marginLeft: '12px', fontWeight: '600' }}>
            {isHost ? 'Broadcasting' : 'Watching'}
          </span>
        </div>
        <div className="viewer-count">
          <Eye size={20} />
          <span>{viewerCount} viewers</span>
        </div>
      </div>

      <div className="stream-player">
        <div id="stream-player" style={{ width: '100%', height: '100%', position: 'relative' }}></div>

        {!isLive && !isHost && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Waiting for host to start...</p>
          </div>
        )}
      </div>

      {isHost && (
        <div className="stream-controls">
          <button
            className={`control-btn ${isAudioEnabled ? 'active' : 'danger'}`}
            onClick={toggleAudio}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          <button
            className={`control-btn ${isVideoEnabled ? 'active' : 'danger'}`}
            onClick={toggleVideo}
            title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
          >
            {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </button>

          <button
            className="control-btn"
            onClick={() => setShowChat(!showChat)}
            title="Toggle Chat"
          >
            <MessageCircle size={24} />
          </button>

          <button
            className="control-btn danger"
            onClick={endStream}
            title="End Stream"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      )}

      {showChat && (
        <div className="chat-panel">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>
                No messages yet. Be the first to comment!
              </p>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="chat-message">
                  <div className="username">{msg.username}</div>
                  <div>{msg.text}</div>
                </div>
              ))
            )}
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveStream
