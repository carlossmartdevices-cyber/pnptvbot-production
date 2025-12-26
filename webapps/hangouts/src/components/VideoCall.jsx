import { useState, useEffect, useRef } from 'react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Settings,
  Monitor,
  MonitorOff,
} from 'lucide-react'

const VideoCall = ({ room, token, uid, username, type, appId }) => {
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null })
  const [remoteUsers, setRemoteUsers] = useState([])
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [error, setError] = useState(null)

  const clientRef = useRef(null)
  const screenClientRef = useRef(null)
  const screenTrackRef = useRef(null)

  useEffect(() => {
    // Initialize Agora client
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
    clientRef.current = client

    // Join channel and initialize media
    const init = async () => {
      try {
        // Set up event listeners
        client.on('user-published', handleUserPublished)
        client.on('user-unpublished', handleUserUnpublished)
        client.on('user-left', handleUserLeft)

        // Join the channel
        await client.join(appId, room, token, uid)

        // Create and publish local tracks
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()

        setLocalTracks({ audio: audioTrack, video: videoTrack })

        // Publish local tracks
        await client.publish([audioTrack, videoTrack])

        setIsJoined(true)

        // Play local video
        if (videoTrack) {
          videoTrack.play('local-player')
        }
      } catch (err) {
        console.error('Failed to join channel:', err)
        setError(err.message)
      }
    }

    init()

    // Cleanup on unmount
    return () => {
      leaveChannel()
    }
  }, [])

  const handleUserPublished = async (user, mediaType) => {
    const client = clientRef.current
    await client.subscribe(user, mediaType)

    if (mediaType === 'video') {
      setRemoteUsers((prev) => {
        const existing = prev.find((u) => u.uid === user.uid)
        if (existing) {
          return prev.map((u) =>
            u.uid === user.uid ? { ...u, videoTrack: user.videoTrack } : u
          )
        }
        return [...prev, { uid: user.uid, videoTrack: user.videoTrack, audioTrack: null }]
      })

      // Play remote video
      setTimeout(() => {
        const playerElement = document.getElementById(`player-${user.uid}`)
        if (playerElement && user.videoTrack) {
          user.videoTrack.play(`player-${user.uid}`)
        }
      }, 100)
    }

    if (mediaType === 'audio') {
      setRemoteUsers((prev) => {
        const existing = prev.find((u) => u.uid === user.uid)
        if (existing) {
          return prev.map((u) =>
            u.uid === user.uid ? { ...u, audioTrack: user.audioTrack } : u
          )
        }
        return [...prev, { uid: user.uid, audioTrack: user.audioTrack, videoTrack: null }]
      })

      // Play remote audio
      if (user.audioTrack) {
        user.audioTrack.play()
      }
    }
  }

  const handleUserUnpublished = (user, mediaType) => {
    if (mediaType === 'video') {
      setRemoteUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, videoTrack: null } : u))
      )
    }

    if (mediaType === 'audio') {
      setRemoteUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, audioTrack: null } : u))
      )
    }
  }

  const handleUserLeft = (user) => {
    setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid))
  }

  const toggleAudio = async () => {
    if (localTracks.audio) {
      if (isAudioEnabled) {
        await localTracks.audio.setEnabled(false)
        setIsAudioEnabled(false)
      } else {
        await localTracks.audio.setEnabled(true)
        setIsAudioEnabled(true)
      }
    }
  }

  const toggleVideo = async () => {
    if (localTracks.video) {
      if (isVideoEnabled) {
        await localTracks.video.setEnabled(false)
        setIsVideoEnabled(false)
      } else {
        await localTracks.video.setEnabled(true)
        setIsVideoEnabled(true)
      }
    }
  }

  const toggleScreenShare = async () => {
    const client = clientRef.current

    if (!isScreenSharing) {
      try {
        // Create screen track
        const screenTrack = await AgoraRTC.createScreenVideoTrack()
        screenTrackRef.current = screenTrack

        // Unpublish camera and publish screen
        if (localTracks.video) {
          await client.unpublish(localTracks.video)
        }

        await client.publish(screenTrack)

        // Play screen share locally
        screenTrack.play('local-player')

        setIsScreenSharing(true)

        // Handle screen share stop event
        screenTrack.on('track-ended', async () => {
          await stopScreenShare()
        })
      } catch (err) {
        console.error('Failed to start screen sharing:', err)
      }
    } else {
      await stopScreenShare()
    }
  }

  const stopScreenShare = async () => {
    const client = clientRef.current
    const screenTrack = screenTrackRef.current

    if (screenTrack) {
      screenTrack.stop()
      screenTrack.close()
      await client.unpublish(screenTrack)
      screenTrackRef.current = null
    }

    // Republish camera
    if (localTracks.video && isVideoEnabled) {
      await client.publish(localTracks.video)
      localTracks.video.play('local-player')
    }

    setIsScreenSharing(false)
  }

  const leaveChannel = async () => {
    const client = clientRef.current

    // Stop and close local tracks
    if (localTracks.audio) {
      localTracks.audio.stop()
      localTracks.audio.close()
    }

    if (localTracks.video) {
      localTracks.video.stop()
      localTracks.video.close()
    }

    // Stop screen sharing if active
    if (isScreenSharing) {
      await stopScreenShare()
    }

    // Leave the channel
    if (client) {
      await client.leave()
    }

    setIsJoined(false)

    // Redirect back to Telegram or close window
    window.close()
  }

  const getGridClass = () => {
    const totalUsers = remoteUsers.length + 1
    if (totalUsers === 1) return 'single'
    if (totalUsers === 2) return 'two'
    if (totalUsers <= 4) return 'four'
    return 'many'
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
    <>
      <div className="header">
        <div className="room-info">
          <h2>{type === 'main' ? 'Main Room' : 'Private Call'}</h2>
          <p>
            {remoteUsers.length + 1} participant{remoteUsers.length !== 0 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="control-btn"
            onClick={() => setShowParticipants(!showParticipants)}
            title="Participants"
          >
            <Users size={24} />
          </button>
          <button
            className="control-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={24} />
          </button>
        </div>
      </div>

      <div className={`video-container ${getGridClass()}`}>
        {/* Local video */}
        <div className="video-player local">
          <div id="local-player" style={{ width: '100%', height: '100%' }}></div>
          <div className={`player-info ${!isAudioEnabled ? 'muted' : ''}`}>
            {!isAudioEnabled && <MicOff size={16} />}
            {username} (You)
          </div>
        </div>

        {/* Remote videos */}
        {remoteUsers.map((user) => (
          <div key={user.uid} className="video-player">
            <div id={`player-${user.uid}`} style={{ width: '100%', height: '100%' }}></div>
            <div className="player-info">
              User {user.uid}
            </div>
          </div>
        ))}
      </div>

      <div className="controls">
        <button
          className={`control-btn ${isAudioEnabled ? 'active' : 'danger'}`}
          onClick={toggleAudio}
          disabled={!isJoined}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button
          className={`control-btn ${isVideoEnabled ? 'active' : 'danger'}`}
          onClick={toggleVideo}
          disabled={!isJoined}
          title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
        >
          {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        <button
          className={`control-btn ${isScreenSharing ? 'active' : ''}`}
          onClick={toggleScreenShare}
          disabled={!isJoined}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
        </button>

        <button
          className="control-btn danger"
          onClick={leaveChannel}
          title="Leave Call"
        >
          <PhoneOff size={24} />
        </button>
      </div>

      {showParticipants && (
        <div className="participants-list">
          <h3>Participants ({remoteUsers.length + 1})</h3>
          <div className="participant-item">
            {username} (You)
          </div>
          {remoteUsers.map((user) => (
            <div key={user.uid} className="participant-item">
              User {user.uid}
            </div>
          ))}
        </div>
      )}

      {showSettings && (
        <div className="settings-panel">
          <h3>Settings</h3>
          <div className="setting-item">
            <label>Room: {room}</label>
          </div>
          <div className="setting-item">
            <label>User ID: {uid}</label>
          </div>
          <div className="setting-item">
            <label>Type: {type}</label>
          </div>
        </div>
      )}
    </>
  )
}

export default VideoCall
