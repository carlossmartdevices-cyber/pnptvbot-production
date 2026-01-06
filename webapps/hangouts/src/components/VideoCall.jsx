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

const VideoCall = ({ room, token, uid, username, type, appId, hasConsent, onConsentGranted }) => {
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null })
  const [remoteUsers, setRemoteUsers] = useState([])
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [error, setError] = useState(null)
  const [isReadyToJoin, setIsReadyToJoin] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false)
  const [showRoomDetails, setShowRoomDetails] = useState(false)
  const [privacyMode, setPrivacyMode] = useState(true)

  const clientRef = useRef(null)
  const screenClientRef = useRef(null)
  const screenTrackRef = useRef(null)

  useEffect(() => {
    // Initialize Agora client
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
    clientRef.current = client

    // Set up event listeners (safe before join)
    client.on('user-published', handleUserPublished)
    client.on('user-unpublished', handleUserUnpublished)
    client.on('user-left', handleUserLeft)

    // Cleanup on unmount
    return () => {
      leaveChannel()
    }
  }, [])

  const createLocalTracks = async ({ enableAudio, enableVideo }) => {
    const [audioTrack, videoTrack] = await Promise.all([
      enableAudio ? AgoraRTC.createMicrophoneAudioTrack() : Promise.resolve(null),
      enableVideo ? AgoraRTC.createCameraVideoTrack() : Promise.resolve(null),
    ])

    setLocalTracks({ audio: audioTrack, video: videoTrack })
    setIsAudioEnabled(Boolean(audioTrack))
    setIsVideoEnabled(Boolean(videoTrack))

    return { audioTrack, videoTrack }
  }

  const joinChannel = async () => {
    const client = clientRef.current
    if (!client) return

    try {
      setError(null)
      setIsReadyToJoin(false)

      await client.join(appId, room, token, uid)

      const { audioTrack, videoTrack } = await createLocalTracks({
        enableAudio: isAudioEnabled,
        enableVideo: isVideoEnabled,
      })

      const tracksToPublish = [audioTrack, videoTrack].filter(Boolean)
      if (tracksToPublish.length) {
        await client.publish(tracksToPublish)
      }

      setIsJoined(true)

      if (videoTrack) {
        videoTrack.play('local-player')
      }
    } catch (err) {
      console.error('Failed to join channel:', err)
      setError(err?.message || 'Failed to join room')
      try {
        await client?.leave()
      } catch (_) {
        // ignore
      }
    }
  }

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
    if (!isJoined) {
      setIsAudioEnabled((prev) => !prev)
      return
    }

    if (localTracks.audio) {
      if (isAudioEnabled) {
        await localTracks.audio.setEnabled(false)
        setIsAudioEnabled(false)
        return
      }

      await localTracks.audio.setEnabled(true)
      setIsAudioEnabled(true)
      return
    }

    const client = clientRef.current
    if (!client) return
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack()
    setLocalTracks((prev) => ({ ...prev, audio: audioTrack }))
    await client.publish(audioTrack)
    setIsAudioEnabled(true)
  }

  const toggleVideo = async () => {
    if (!isJoined) {
      setIsVideoEnabled((prev) => !prev)
      return
    }

    if (localTracks.video) {
      if (isVideoEnabled) {
        await localTracks.video.setEnabled(false)
        setIsVideoEnabled(false)
        return
      }

      await localTracks.video.setEnabled(true)
      setIsVideoEnabled(true)
      return
    }

    const client = clientRef.current
    if (!client) return
    const videoTrack = await AgoraRTC.createCameraVideoTrack()
    setLocalTracks((prev) => ({ ...prev, video: videoTrack }))
    await client.publish(videoTrack)
    videoTrack.play('local-player')
    setIsVideoEnabled(true)
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

  const safeLabelForUser = (userId) => {
    const raw = String(userId ?? '')
    const suffix = raw.length > 4 ? raw.slice(-4) : raw
    return `Participant ••••${suffix}`
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

  if (!hasConsent) {
    return (
      <div className="gate">
        <div className="gate-card">
          <h2>{type === 'main' ? 'PNP Room' : 'Private Call'}</h2>
          <p className="gate-subtitle">
            Private-by-default. Nothing starts until you confirm.
          </p>

          <div className="gate-checks">
            <label className="gate-check">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
              />
              I confirm I am 18+ (or legal age in my country)
            </label>
            <label className="gate-check">
              <input
                type="checkbox"
                checked={privacyConfirmed}
                onChange={(e) => setPrivacyConfirmed(e.target.checked)}
              />
              I understand this is private content; don’t record or share links
            </label>
          </div>

          <div className="gate-actions">
            <button
              className="gate-btn"
              disabled={!ageConfirmed || !privacyConfirmed}
              onClick={onConsentGranted}
            >
              Continue
            </button>
            <button className="gate-btn secondary" onClick={() => window.close()}>
              Exit
            </button>
          </div>

          <div className="gate-footnote">
            Tip: open in a private window, disable screen recording, and keep your link secret.
          </div>
        </div>
      </div>
    )
  }

  if (!isJoined) {
    return (
      <div className="prejoin">
        <div className="prejoin-card">
          <h2>{type === 'main' ? 'PNP Room' : 'Private Call'}</h2>
          <p className="prejoin-subtitle">
            You are not connected yet. Choose what to share.
          </p>

          <div className="prejoin-toggles">
            <button
              className={`toggle-btn ${isAudioEnabled ? 'on' : 'off'}`}
              onClick={toggleAudio}
              aria-pressed={isAudioEnabled}
            >
              {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              Mic {isAudioEnabled ? 'On' : 'Off'}
            </button>
            <button
              className={`toggle-btn ${isVideoEnabled ? 'on' : 'off'}`}
              onClick={toggleVideo}
              aria-pressed={isVideoEnabled}
            >
              {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              Camera {isVideoEnabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="prejoin-actions">
            <button
              className="gate-btn"
              onClick={async () => {
                setIsReadyToJoin(true)
                await joinChannel()
              }}
              disabled={isReadyToJoin}
            >
              {isReadyToJoin ? 'Joining…' : 'Join Now'}
            </button>
            <button className="gate-btn secondary" onClick={() => window.close()}>
              Exit
            </button>
          </div>

          <div className="prejoin-footnote">
            Privacy mode is enabled by default (hides identifying details).
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="header">
        <div className="room-info">
          <h2>{type === 'main' ? 'PNP Room' : 'Private Call'}</h2>
          <p>
            {remoteUsers.length + 1} participant{remoteUsers.length !== 0 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className={`control-btn ${privacyMode ? 'active' : ''}`}
            onClick={() => setPrivacyMode((prev) => !prev)}
            title={privacyMode ? 'Privacy Mode: On' : 'Privacy Mode: Off'}
          >
            Privacy
          </button>
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

      <div className={`video-container ${getGridClass()} ${privacyMode ? 'privacy' : ''}`}>
        {/* Local video */}
        <div className="video-player local">
          <div id="local-player" style={{ width: '100%', height: '100%' }}></div>
          <div className={`player-info ${!isAudioEnabled ? 'muted' : ''}`}>
            {!isAudioEnabled && <MicOff size={16} />}
            {privacyMode ? 'You' : `${username || 'You'} (You)`}
          </div>
        </div>

        {/* Remote videos */}
        {remoteUsers.map((user) => (
          <div key={user.uid} className="video-player">
            <div id={`player-${user.uid}`} style={{ width: '100%', height: '100%' }}></div>
            <div className="player-info">
              {privacyMode ? safeLabelForUser(user.uid) : `User ${user.uid}`}
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
            {privacyMode ? 'You' : `${username || 'You'} (You)`}
          </div>
          {remoteUsers.map((user) => (
            <div key={user.uid} className="participant-item">
              {privacyMode ? safeLabelForUser(user.uid) : `User ${user.uid}`}
            </div>
          ))}
        </div>
      )}

      {showSettings && (
        <div className="settings-panel">
          <h3>Settings</h3>
          <div className="setting-item">
            <label>Privacy Mode</label>
            <div className="setting-note">
              When enabled, the UI hides room/user details and obfuscates participant IDs.
            </div>
          </div>
          <div className="setting-item">
            <button
              className="link-btn"
              onClick={() => setShowRoomDetails((prev) => !prev)}
            >
              {showRoomDetails ? 'Hide' : 'Show'} room details
            </button>
            {showRoomDetails && (
              <div className="setting-note">
                <div>Room: {room}</div>
                <div>User ID: {uid}</div>
                <div>Type: {type}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default VideoCall
