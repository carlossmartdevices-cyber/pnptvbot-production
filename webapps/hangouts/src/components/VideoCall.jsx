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
  X,
} from 'lucide-react'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function Sheet({ open, title, children, onClose }) {
  if (!open) return null
  return (
    <div className="sheetBackdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheetHeader">
          <div className="sheetTitle">
            <div className="titleText">{title}</div>
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="sheetBody">{children}</div>
      </div>
    </div>
  )
}

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

  const callTitle = type === 'main' ? 'PNP Room' : 'Private Call'
  const participantCount = remoteUsers.length + 1

  if (error) {
    return (
      <>
        <header className="header">
          <div className="brand">
            <div className="brandMark">
              <Video size={18} />
            </div>
            <div className="brandText">
              <div className="brandName">PNPtv Hangouts</div>
              <div className="brandTag">{callTitle} • {participantCount} participants</div>
            </div>
          </div>
          <div className="headerActions">
            <button className="iconBtn danger" onClick={() => window.close()} title="Exit" aria-label="Exit">
              <X size={20} />
            </button>
          </div>
        </header>
        <main className="main callBody">
          <div className="notice error">{error}</div>
        </main>
      </>
    )
  }

  if (!hasConsent) {
    return (
      <>
        <header className="header">
          <div className="brand">
            <div className="brandMark">
              <Video size={18} />
            </div>
            <div className="brandText">
              <div className="brandName">PNPtv Hangouts</div>
              <div className="brandTag">{callTitle} • Private-by-default • 18+</div>
            </div>
          </div>
          <div className="headerActions">
            <button className="iconBtn danger" onClick={() => window.close()} title="Exit" aria-label="Exit">
              <X size={20} />
            </button>
          </div>
        </header>

        <main className="main callBody">
          <div className="hero">
            <div className="heroTitle">Confirm before entering</div>
            <div className="heroText">Nothing starts until you confirm.</div>
            <div className="card">
              <div className="checkList">
                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                  />
                  <span>I confirm I am 18+ (or legal age in my country)</span>
                </label>
                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={privacyConfirmed}
                    onChange={(e) => setPrivacyConfirmed(e.target.checked)}
                  />
                  <span>I understand this is private content; don’t record or share links</span>
                </label>
              </div>

              <div className="heroActions">
                <button
                  className="btn"
                  disabled={!ageConfirmed || !privacyConfirmed}
                  onClick={onConsentGranted}
                >
                  Continue
                </button>
                <button className="btn btnGhost" onClick={() => window.close()}>
                  Exit
                </button>
              </div>
            </div>

            <div className="hint">
              Tip: open in a private window, disable screen recording, and keep your link secret.
            </div>
          </div>
        </main>
      </>
    )
  }

  if (!isJoined) {
    return (
      <>
        <header className="header">
          <div className="brand">
            <div className="brandMark">
              <Video size={18} />
            </div>
            <div className="brandText">
              <div className="brandName">PNPtv Hangouts</div>
              <div className="brandTag">{callTitle} • Pre-join • 18+</div>
            </div>
          </div>
          <div className="headerActions">
            <button
              className={cx('iconBtn', privacyMode && 'active')}
              onClick={() => setPrivacyMode((prev) => !prev)}
              title={privacyMode ? 'Privacy Mode: On' : 'Privacy Mode: Off'}
              aria-label="Toggle privacy mode"
            >
              {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button className="iconBtn danger" onClick={() => window.close()} title="Exit" aria-label="Exit">
              <X size={20} />
            </button>
          </div>
        </header>

        <main className="main callBody">
          <div className="hero">
            <div className="heroTitle">Ready when you are</div>
            <div className="heroText">Choose what to share before joining.</div>

            <div className="card">
              <div className="prejoin-preview">
                <div className={cx('prejoin-preview-box', isVideoEnabled && 'on')}>
                  <div id="prejoin-player" className="prejoin-player" />
                  {!isVideoEnabled ? <div className="prejoin-preview-overlay">Camera preview is off</div> : null}
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
                    <div className="hint">Hides room/user details.</div>
                  </div>
                </div>
              </div>

              <div className="segmented prejoin-toggles">
                <button
                  className={cx('seg', isAudioEnabled && 'active')}
                  onClick={toggleAudio}
                  aria-pressed={isAudioEnabled}
                  type="button"
                >
                  {isAudioEnabled ? <Mic size={16} /> : <MicOff size={16} />} Mic
                </button>
                <button
                  className={cx('seg', isVideoEnabled && 'active')}
                  onClick={toggleVideo}
                  aria-pressed={isVideoEnabled}
                  type="button"
                >
                  {isVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />} Camera
                </button>
              </div>

              <div className="prejoin-devices">
                <label className="field">
                  <div className="label">Microphone</div>
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
                </label>

                <label className="field">
                  <div className="label">Camera</div>
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
                </label>

                <button className="btn btnGhost" onClick={refreshDevices} type="button">
                  Refresh devices
                </button>
              </div>

              <div className="heroActions">
                <button className="btn" onClick={joinChannel} disabled={isReadyToJoin}>
                  {isReadyToJoin ? 'Joining…' : 'Join now'}
                </button>
                <button className="btn btnGhost" onClick={() => window.close()}>
                  Exit
                </button>
              </div>
            </div>
          </div>

          <div className="hint">Privacy mode is enabled by default.</div>
        </main>
      </>
    )
  }

  return (
    <>
      <header className="header">
        <div className="brand">
          <div className="brandMark">
            <Video size={18} />
          </div>
          <div className="brandText">
            <div className="brandName">PNPtv Hangouts</div>
            <div className="brandTag">
              {callTitle} • {participantCount} participants • <span className="monoInline">{privacyMode ? 'Privacy on' : 'Privacy off'}</span>
            </div>
          </div>
        </div>
        <div className="headerActions">
          <button
            className={cx('iconBtn', privacyMode && 'active')}
            onClick={() => setPrivacyMode((prev) => !prev)}
            title={privacyMode ? 'Privacy Mode: On' : 'Privacy Mode: Off'}
            aria-label="Toggle privacy mode"
          >
            {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <button
            className="iconBtn"
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
            aria-label="Copy room code"
          >
            <Copy size={20} />
          </button>
          <button className="iconBtn" onClick={() => setShowParticipants(true)} title="Participants" aria-label="Participants">
            <Users size={20} />
          </button>
          <button className="iconBtn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="main callBody">
        <div className="call-status">
          <span className="status-pill">
            <Signal size={14} /> {connectionState}
          </span>
          <span className="status-pill">
            <span className="dot" /> {qualityLabel}
          </span>
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
      </main>

      <div className="callControls">
        <button
          className={cx('iconBtn', 'callBtn', isAudioEnabled ? 'active' : '')}
          onClick={toggleAudio}
          disabled={!isJoined}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
          aria-label={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
        </button>

        <button
          className={cx('iconBtn', 'callBtn', isVideoEnabled ? 'active' : '')}
          onClick={toggleVideo}
          disabled={!isJoined}
          title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
          aria-label={isVideoEnabled ? 'Stop video' : 'Start video'}
        >
          {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
        </button>

        <button
          className={cx('iconBtn', 'callBtn', isScreenSharing ? 'active' : '')}
          onClick={toggleScreenShare}
          disabled={!isJoined}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
        </button>

        <button className="iconBtn callBtn danger" onClick={leaveChannel} title="Leave Call" aria-label="Leave call">
          <PhoneOff size={22} />
        </button>
      </div>

      <Sheet open={showParticipants} title={`Participants (${participantCount})`} onClose={() => setShowParticipants(false)}>
        <div className="list">
          <div className="listItem">{privacyMode ? 'You' : `${username || 'You'} (You)`}</div>
          {remoteUsers.map((user) => (
            <div key={user.uid} className="listItem">
              {privacyMode ? safeLabelForUser(user.uid) : `User ${user.uid}`}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={showSettings} title="Settings" onClose={() => setShowSettings(false)}>
        <div className="card">
          <div className="hint">Change mic/camera without leaving.</div>

          <label className="field" style={{ marginTop: 10 }}>
            <div className="label">Microphone</div>
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
          </label>

          <label className="field">
            <div className="label">Camera</div>
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
          </label>

          <div className="heroActions">
            <button className="btn btnGhost" onClick={refreshDevices} type="button">
              Refresh devices
            </button>
            <button className="btn btnGhost" onClick={() => setShowRoomDetails((prev) => !prev)} type="button">
              {showRoomDetails ? 'Hide' : 'Show'} room details
            </button>
          </div>

          {showRoomDetails ? (
            <div className="monoTextarea">
              Room: {room}{'\n'}
              User ID: {uid}{'\n'}
              Type: {type}{'\n'}
              Connection: {connectionState}{'\n'}
              Quality: {qualityLabel}
            </div>
          ) : null}
        </div>
      </Sheet>

      {copied ? <div className="toast">Copied room code</div> : null}
    </>
  )
}

export default VideoCall
