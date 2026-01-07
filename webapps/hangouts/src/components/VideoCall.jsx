import { useMemo, useState, useEffect, useRef } from 'react'
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
  Copy,
  Signal,
  Eye,
  EyeOff,
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
  const [mics, setMics] = useState([])
  const [cameras, setCameras] = useState([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [micLevel, setMicLevel] = useState(0)
  const [connectionState, setConnectionState] = useState('DISCONNECTED')
  const [networkQuality, setNetworkQuality] = useState({ uplink: null, downlink: null })
  const [copied, setCopied] = useState(false)

  const clientRef = useRef(null)
  const screenTrackRef = useRef(null)
  const wakeLockRef = useRef(null)

  useEffect(() => {
    // Initialize Agora client
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
    clientRef.current = client

    // Set up event listeners (safe before join)
    client.on('user-published', handleUserPublished)
    client.on('user-unpublished', handleUserUnpublished)
    client.on('user-left', handleUserLeft)
    client.on('connection-state-change', (curState) => {
      setConnectionState(String(curState || 'UNKNOWN').toUpperCase())
    })
    client.on('network-quality', (quality) => {
      if (!quality) return
      setNetworkQuality({
        uplink: quality.uplinkNetworkQuality,
        downlink: quality.downlinkNetworkQuality,
      })
    })

    // Cleanup on unmount
    return () => {
      leaveChannel()
    }
  }, [])

  const qualityLabel = useMemo(() => {
    const q = Math.max(networkQuality.uplink ?? 0, networkQuality.downlink ?? 0)
    if (!q) return '—'
    if (q <= 2) return 'Excellent'
    if (q <= 3) return 'Good'
    if (q <= 4) return 'Fair'
    if (q <= 5) return 'Poor'
    return 'Bad'
  }, [networkQuality])

  const refreshDevices = async () => {
    try {
      const [micDevices, cameraDevices] = await Promise.all([
        AgoraRTC.getMicrophones(),
        AgoraRTC.getCameras(),
      ])
      setMics(micDevices || [])
      setCameras(cameraDevices || [])
      setSelectedMicId((prev) => prev || micDevices?.[0]?.deviceId || '')
      setSelectedCameraId((prev) => prev || cameraDevices?.[0]?.deviceId || '')
    } catch (e) {
      // If permissions are blocked, device enumeration can fail.
    }
  }

  useEffect(() => {
    refreshDevices()
  }, [])

  useEffect(() => {
    if (!localTracks.audio || !isAudioEnabled) {
      setMicLevel(0)
      return undefined
    }

    const t = setInterval(() => {
      try {
        const v = localTracks.audio?.getVolumeLevel?.() ?? 0
        setMicLevel(Math.max(0, Math.min(1, v)))
      } catch (_) {
        // ignore
      }
    }, 120)
    return () => clearInterval(t)
  }, [localTracks.audio, isAudioEnabled])

  const ensureWakeLock = async () => {
    try {
      if (!('wakeLock' in navigator)) return
      if (wakeLockRef.current) return
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null
      })
    } catch (_) {
      // ignore
    }
  }

  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release?.()
    } catch (_) {
      // ignore
    }
    wakeLockRef.current = null
  }

  const stopAndCloseTrack = (track) => {
    try { track?.stop?.() } catch (_) { /* ignore */ }
    try { track?.close?.() } catch (_) { /* ignore */ }
  }

  const playLocalPreview = (track) => {
    try {
      if (!track) return
      track.play('prejoin-player')
    } catch (_) {
      // ignore
    }
  }

  const playInElement = (track, elementId) => {
    try {
      if (!track) return
      track.stop?.()
    } catch (_) {
      // ignore
    }
    try {
      track?.play?.(elementId)
    } catch (_) {
      // ignore
    }
  }

  const createOrUpdateAudioTrack = async () => {
    if (localTracks.audio) {
      if (selectedMicId && typeof localTracks.audio.setDevice === 'function') {
        await localTracks.audio.setDevice(selectedMicId)
      }
      await localTracks.audio.setEnabled(true)
      setIsAudioEnabled(true)
      return localTracks.audio
    }

    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack(
      selectedMicId ? { microphoneId: selectedMicId } : undefined
    )
    setLocalTracks((prev) => ({ ...prev, audio: audioTrack }))
    setIsAudioEnabled(true)
    return audioTrack
  }

  const createOrUpdateVideoTrack = async () => {
    if (localTracks.video) {
      if (selectedCameraId && typeof localTracks.video.setDevice === 'function') {
        await localTracks.video.setDevice(selectedCameraId)
      }
      await localTracks.video.setEnabled(true)
      setIsVideoEnabled(true)
      playLocalPreview(localTracks.video)
      return localTracks.video
    }

    const videoTrack = await AgoraRTC.createCameraVideoTrack(
      selectedCameraId ? { cameraId: selectedCameraId } : undefined
    )
    setLocalTracks((prev) => ({ ...prev, video: videoTrack }))
    setIsVideoEnabled(true)
    playLocalPreview(videoTrack)
    return videoTrack
  }

  const joinChannel = async () => {
    const client = clientRef.current
    if (!client) return

    try {
      setError(null)
      setIsReadyToJoin(true)

      await client.join(appId, room, token, uid)

      const tracksToPublish = []
      let joinedVideoTrack = null

      if (isAudioEnabled) {
        const audioTrack = await createOrUpdateAudioTrack()
        if (audioTrack) tracksToPublish.push(audioTrack)
      }

      if (isVideoEnabled) {
        const videoTrack = await createOrUpdateVideoTrack()
        if (videoTrack) {
          joinedVideoTrack = videoTrack
          tracksToPublish.push(videoTrack)
        }
      }

      if (tracksToPublish.length) await client.publish(tracksToPublish)

      setIsJoined(true)
      await ensureWakeLock()

      if (joinedVideoTrack) playInElement(joinedVideoTrack, 'local-player')
    } catch (err) {
      console.error('Failed to join channel:', err)
      setError(err?.message || 'Failed to join room')
      try {
        await client?.leave()
      } catch (_) {
        // ignore
      }
    } finally {
      setIsReadyToJoin(false)
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
      const attemptPlay = (attempt = 0) => {
        const playerElement = document.getElementById(`player-${user.uid}`)
        if (playerElement && user.videoTrack) {
          try { user.videoTrack.play(`player-${user.uid}`) } catch (_) { /* ignore */ }
          return
        }
        if (attempt < 15) setTimeout(() => attemptPlay(attempt + 1), 120)
      }
      setTimeout(() => attemptPlay(0), 80)
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
      if (isAudioEnabled) {
        stopAndCloseTrack(localTracks.audio)
        setLocalTracks((prev) => ({ ...prev, audio: null }))
        setIsAudioEnabled(false)
        return
      }
      try {
        await createOrUpdateAudioTrack()
      } catch (e) {
        setError(e?.message || 'Microphone permission denied')
      }
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
    try {
      const audioTrack = await createOrUpdateAudioTrack()
      await client.publish(audioTrack)
    } catch (e) {
      setError(e?.message || 'Microphone permission denied')
    }
  }

  const toggleVideo = async () => {
    if (!isJoined) {
      if (isVideoEnabled) {
        stopAndCloseTrack(localTracks.video)
        setLocalTracks((prev) => ({ ...prev, video: null }))
        setIsVideoEnabled(false)
        return
      }
      try {
        await createOrUpdateVideoTrack()
      } catch (e) {
        setError(e?.message || 'Camera permission denied')
      }
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
      playInElement(localTracks.video, 'local-player')
      return
    }

    const client = clientRef.current
    if (!client) return
    try {
      const videoTrack = await createOrUpdateVideoTrack()
      await client.publish(videoTrack)
      videoTrack.play('local-player')
    } catch (e) {
      setError(e?.message || 'Camera permission denied')
    }
  }

  const toggleScreenShare = async () => {
    const client = clientRef.current

    if (!isScreenSharing) {
      try {
        // Create screen track
        const created = await AgoraRTC.createScreenVideoTrack()
        const screenTrack = Array.isArray(created) ? created[0] : created
        screenTrackRef.current = screenTrack

        // Unpublish camera and publish screen
        if (localTracks.video) {
          await client.unpublish(localTracks.video)
        }

        await client.publish(screenTrack)

        // Play screen share locally
        playInElement(screenTrack, 'local-player')

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
      try {
        await client.unpublish(screenTrack)
      } catch (_) {
        // ignore
      }
      stopAndCloseTrack(screenTrack)
      screenTrackRef.current = null
    }

    // Republish camera
    if (localTracks.video && isVideoEnabled) {
      await client.publish(localTracks.video)
      playInElement(localTracks.video, 'local-player')
    }

    setIsScreenSharing(false)
  }

  const leaveChannel = async () => {
    const client = clientRef.current

    // Stop screen sharing if active
    if (isScreenSharing) {
      await stopScreenShare()
    }

    // Stop and close local tracks
    stopAndCloseTrack(localTracks.audio)
    stopAndCloseTrack(localTracks.video)

    // Leave the channel
    if (client) {
      await client.leave()
    }

    setIsJoined(false)
    await releaseWakeLock()

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

          <div className="prejoin-preview">
            <div className={`prejoin-preview-box ${isVideoEnabled ? 'on' : 'off'}`}>
              <div id="prejoin-player" className="prejoin-player" />
              {!isVideoEnabled ? (
                <div className="prejoin-preview-overlay">
                  Camera preview is off
                </div>
              ) : null}
            </div>
            <div className="prejoin-stats">
              <div className="stat">
                <div className="stat-label">Mic</div>
                <div className="stat-value">{isAudioEnabled ? 'On' : 'Off'}</div>
                <div className="meter">
                  <div className="meter-fill" style={{ width: `${Math.round(micLevel * 100)}%` }} />
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Privacy</div>
                <div className="stat-value">{privacyMode ? 'On' : 'Off'}</div>
              </div>
            </div>
          </div>

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

          <div className="prejoin-devices">
            <div className="device-row">
              <label>Microphone</label>
              <select
                value={selectedMicId}
                onChange={async (e) => {
                  const next = e.target.value
                  setSelectedMicId(next)
                  try {
                    if (localTracks.audio && typeof localTracks.audio.setDevice === 'function') {
                      await localTracks.audio.setDevice(next)
                    }
                  } catch (_) {
                    // ignore
                  }
                }}
              >
                {mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="device-row">
              <label>Camera</label>
              <select
                value={selectedCameraId}
                onChange={async (e) => {
                  const next = e.target.value
                  setSelectedCameraId(next)
                  try {
                    if (localTracks.video && typeof localTracks.video.setDevice === 'function') {
                      await localTracks.video.setDevice(next)
                      playLocalPreview(localTracks.video)
                    }
                  } catch (_) {
                    // ignore
                  }
                }}
              >
                {cameras.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>
            <button className="link-btn" onClick={refreshDevices}>
              Refresh devices
            </button>
          </div>

        <div className="prejoin-actions">
          <button
            className="gate-btn"
            onClick={async () => {
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
          <div className="call-status">
            <span className="status-pill">
              <Signal size={14} /> {connectionState}
            </span>
            <span className="status-pill">
              <span className="dot" /> {qualityLabel}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className={`control-btn ${privacyMode ? 'active' : ''}`}
            onClick={() => setPrivacyMode((prev) => !prev)}
            title={privacyMode ? 'Privacy Mode: On' : 'Privacy Mode: Off'}
          >
            {privacyMode ? <EyeOff size={24} /> : <Eye size={24} />}
          </button>
          <button
            className="control-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(room)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              } catch (_) {
                // ignore
              }
            }}
            title="Copy room code"
          >
            <Copy size={24} />
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
            <label>Devices</label>
            <div className="setting-note">Change mic/camera without leaving.</div>
            <div className="device-row">
              <label>Microphone</label>
              <select
                value={selectedMicId}
                onChange={async (e) => {
                  const next = e.target.value
                  setSelectedMicId(next)
                  try {
                    if (localTracks.audio && typeof localTracks.audio.setDevice === 'function') {
                      await localTracks.audio.setDevice(next)
                    }
                  } catch (_) {
                    // ignore
                  }
                }}
              >
                {mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="device-row">
              <label>Camera</label>
              <select
                value={selectedCameraId}
                onChange={async (e) => {
                  const next = e.target.value
                  setSelectedCameraId(next)
                  try {
                    if (localTracks.video && typeof localTracks.video.setDevice === 'function') {
                      await localTracks.video.setDevice(next)
                      localTracks.video.play('local-player')
                    }
                  } catch (_) {
                    // ignore
                  }
                }}
              >
                {cameras.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>
            <button className="link-btn" onClick={refreshDevices}>
              Refresh devices
            </button>
          </div>
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
          {copied ? <div className="setting-note" style={{ color: '#4CAF50' }}>Copied room code</div> : null}
        </div>
      )}
    </>
  )
}

export default VideoCall
