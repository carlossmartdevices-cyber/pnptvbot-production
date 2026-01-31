import { useEffect, useRef, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  Camera,
  LogOut,
  Mic,
  MicOff,
  ShieldCheck,
  Users,
  Link2,
  Video,
  VideoOff,
} from 'lucide-react';

import { stripQueryParams } from '../utils/url';

const CONSENT_KEY = 'pnp_hangouts_consent_v1';

const formatElapsed = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
};

const getUserId = (uid) => {
  const numeric = Number(uid);
  return Number.isFinite(numeric) ? numeric : uid || null;
};

function CallRoom({ params, telegramUser }) {
  const [consent, setConsent] = useState(
    sessionStorage.getItem(CONSENT_KEY) === 'true'
  );
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState('');
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [callStartedAt, setCallStartedAt] = useState(null);

  const prejoinVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });

  const isMainRoom = params.type === 'main';
  const mode = isMainRoom ? 'live' : 'rtc';
  const canPublish = !isMainRoom;
  const resolvedAppId = params.appId || import.meta.env.VITE_AGORA_APP_ID || '';

  useEffect(() => {
    stripQueryParams();
  }, []);

  useEffect(() => {
    const client = AgoraRTC.createClient({ mode, codec: 'vp8' });
    clientRef.current = client;

    const handleUserPublished = async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          const container = document.getElementById(`remote-${user.uid}`);
          if (container) user.videoTrack.play(container);
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
        setRemoteUsers([...client.remoteUsers]);
      } catch (error) {
        console.error('Subscribe error:', error);
      }
    };

    const handleUserUnpublished = (user, mediaType) => {
      if (mediaType === 'video') {
        user.videoTrack?.stop();
      }
      if (mediaType === 'audio') {
        user.audioTrack?.stop();
      }
      setRemoteUsers([...client.remoteUsers]);
    };

    const handleUserLeft = () => {
      setRemoteUsers([...client.remoteUsers]);
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);

    return () => {
      client.removeAllListeners();
    };
  }, [mode]);

  const ensureLocalTracks = async () => {
    const tracks = localTracksRef.current;

    if (micOn && !tracks.audio) {
      tracks.audio = await AgoraRTC.createMicrophoneAudioTrack();
    }
    if (!micOn && tracks.audio) {
      tracks.audio.stop();
      tracks.audio.close();
      tracks.audio = null;
    }

    if (camOn && !tracks.video) {
      tracks.video = await AgoraRTC.createCameraVideoTrack();
      if (prejoinVideoRef.current) {
        tracks.video.play(prejoinVideoRef.current);
      }
    }
    if (!camOn && tracks.video) {
      tracks.video.stop();
      tracks.video.close();
      tracks.video = null;
    }

    localTracksRef.current = tracks;
    return tracks;
  };

  const updateLiveTracks = async () => {
    if (!callStartedAt) return;
    const client = clientRef.current;
    if (!client) return;

    const tracks = localTracksRef.current;

    if (!canPublish) {
      if (tracks.audio) {
        tracks.audio.stop();
        tracks.audio.close();
        tracks.audio = null;
      }
      if (tracks.video) {
        tracks.video.stop();
        tracks.video.close();
        tracks.video = null;
      }
      return;
    }

    if (micOn && !tracks.audio) {
      tracks.audio = await AgoraRTC.createMicrophoneAudioTrack();
      await client.publish(tracks.audio);
    }
    if (!micOn && tracks.audio) {
      await client.unpublish(tracks.audio);
      tracks.audio.stop();
      tracks.audio.close();
      tracks.audio = null;
    }

    if (camOn && !tracks.video) {
      tracks.video = await AgoraRTC.createCameraVideoTrack();
      await client.publish(tracks.video);
      if (localVideoRef.current) tracks.video.play(localVideoRef.current);
    }
    if (!camOn && tracks.video) {
      await client.unpublish(tracks.video);
      tracks.video.stop();
      tracks.video.close();
      tracks.video = null;
    }

    localTracksRef.current = tracks;
  };

  const joinCall = async () => {
    setJoining(true);
    setStatus('');
    try {
      const client = clientRef.current;
      if (!client) throw new Error('Video client not ready');
      if (!resolvedAppId) throw new Error('Missing Agora App ID');

      if (mode === 'live') {
        await client.setClientRole('audience');
      }

      await ensureLocalTracks();

      await client.join(
        resolvedAppId,
        params.room,
        params.token,
        getUserId(params.uid)
      );

      if (canPublish) {
        const tracks = localTracksRef.current;
        const publishTracks = [];
        if (tracks.audio) publishTracks.push(tracks.audio);
        if (tracks.video) publishTracks.push(tracks.video);
        if (publishTracks.length) {
          await client.publish(publishTracks);
        }
      }

      if (localTracksRef.current.video && localVideoRef.current) {
        localTracksRef.current.video.play(localVideoRef.current);
      }

      setRemoteUsers([...client.remoteUsers]);
      setCallStartedAt(Date.now());
    } catch (error) {
      console.error('Join call error:', error);
      setStatus(error?.message || 'Unable to join this room.');
    } finally {
      setJoining(false);
    }
  };

  const leaveCall = async () => {
    try {
      const client = clientRef.current;
      if (client) {
        await client.leave();
      }
    } catch (error) {
      console.error('Leave error:', error);
    }

    const tracks = localTracksRef.current;
    if (tracks.audio) {
      tracks.audio.stop();
      tracks.audio.close();
      tracks.audio = null;
    }
    if (tracks.video) {
      tracks.video.stop();
      tracks.video.close();
      tracks.video = null;
    }

    window.location.href = '/hangouts/';
  };

  const handleConsent = () => {
    sessionStorage.setItem(CONSENT_KEY, 'true');
    setConsent(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus('Copied room link.');
    } catch (error) {
      setStatus('Copy failed.');
    }
  };

  useEffect(() => {
    if (!consent) return;
    ensureLocalTracks();
    return () => {
      const tracks = localTracksRef.current;
      tracks.video?.stop();
    };
  }, [consent, camOn, micOn]);

  useEffect(() => {
    updateLiveTracks().catch((error) => {
      console.error('Failed to update live tracks:', error);
    });
  }, [micOn, camOn, callStartedAt]);

  if (!consent) {
    return (
      <div className="app">
        <div className="bg" />
        <div className="centerCard">
          <div className="heroTitle">Confirm before entering</div>
          <p className="heroText">Nothing starts until you confirm.</p>
          <div className="checkList">
            <label className="checkRow">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
              />
              <span>I confirm I am 18+ (or legal age in my country).</span>
            </label>
            <label className="checkRow">
              <input
                type="checkbox"
                checked={privacyConfirmed}
                onChange={(event) => setPrivacyConfirmed(event.target.checked)}
              />
              <span>I understand this is private content and will not record.</span>
            </label>
          </div>
          <div className="heroActions">
            <button
              className="btn"
              onClick={handleConsent}
              disabled={!ageConfirmed || !privacyConfirmed}
            >
              Continue
            </button>
            <button className="btn btnGhost" onClick={() => window.close()}>
              Exit
            </button>
          </div>
          <div className="hint">
            Tip: open in a private window and keep your link secret.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="bg" />
      <header className="header">
        <div className="brand">
          <div className="brandMark">
            <ShieldCheck size={18} />
          </div>
          <div className="brandText">
            <div className="brandName">PNPtv Hangouts</div>
            <div className="brandTag">
              {params.type} | {privacyMode ? 'Privacy On' : 'Privacy Off'} | 18+
            </div>
          </div>
        </div>
        <div className="headerActions">
          <button
            className={`iconBtn ${privacyMode ? 'active' : ''}`}
            onClick={() => setPrivacyMode((prev) => !prev)}
            aria-label="Toggle privacy mode"
            title="Toggle privacy mode"
          >
            <ShieldCheck size={18} />
          </button>
          <button className="iconBtn danger" onClick={leaveCall} title="Exit">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main callBody">
        <section className="hero">
          <div className="heroTitle">
            {callStartedAt ? 'You are live' : 'Ready when you are'}
          </div>
          <div className="heroText">
            {callStartedAt
              ? `Room is active. ${remoteUsers.length} online.`
              : 'Choose what to share before joining.'}
          </div>

          {!callStartedAt && (
            <div className="card glass">
              <div className="prejoin-preview">
                <div className={`prejoin-preview-box ${camOn ? 'on' : ''}`}>
                  <div ref={prejoinVideoRef} className="prejoin-player" />
                  {!camOn && <div className="prejoin-preview-overlay">Camera preview is off</div>}
                </div>
                <div className="prejoin-stats">
                  <div className="stat">
                    <div className="stat-label">Mic</div>
                    <div className="stat-value">{micOn ? 'On' : 'Off'}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Mode</div>
                    <div className="stat-value">{canPublish ? 'Speaker' : 'Audience'}</div>
                  </div>
                </div>
              </div>

              <div className="segmented prejoin-toggles">
                <button
                  className={`seg ${micOn ? 'active' : ''}`}
                  onClick={() => setMicOn((prev) => !prev)}
                  type="button"
                >
                  {micOn ? <Mic size={16} /> : <MicOff size={16} />} Mic
                </button>
                <button
                  className={`seg ${camOn ? 'active' : ''}`}
                  onClick={() => setCamOn((prev) => !prev)}
                  type="button"
                >
                  {camOn ? <Camera size={16} /> : <VideoOff size={16} />} Camera
                </button>
              </div>

              <div className="heroActions">
                <button className="btn" onClick={joinCall} disabled={joining}>
                  {joining ? 'Joining...' : 'Join now'}
                </button>
                <button className="btn btnGhost" onClick={leaveCall}>
                  Exit
                </button>
              </div>
            </div>
          )}

          {callStartedAt && (
            <div className="callSummary">
              <div className="pill">
                <Users size={14} /> {remoteUsers.length + 1} participants
              </div>
              <div className="pill subtle">
                Live for {formatElapsed(Date.now() - callStartedAt)}
              </div>
              <button className="pill subtle linkBtn" onClick={copyLink}>
                <Link2 size={14} /> Copy link
              </button>
            </div>
          )}
        </section>

        {status && <div className="notice info">{status}</div>}

        {callStartedAt && (
          <section className="videoGrid">
            <div className="videoCard">
              <div className="videoFrame" ref={localVideoRef} />
              <div className="videoLabel">
                {privacyMode ? 'You' : telegramUser?.displayName || params.username}
              </div>
            </div>
            {remoteUsers.map((user) => (
              <div className="videoCard" key={user.uid}>
                <div className="videoFrame" id={`remote-${user.uid}`} />
                <div className="videoLabel">{privacyMode ? 'Guest' : `User ${user.uid}`}</div>
              </div>
            ))}
          </section>
        )}

        {callStartedAt && (
          <div className="controlBar">
            <button className="controlBtn" onClick={() => setMicOn((prev) => !prev)}>
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
              <span>{micOn ? 'Mute' : 'Unmute'}</span>
            </button>
            <button className="controlBtn" onClick={() => setCamOn((prev) => !prev)}>
              {camOn ? <Video size={18} /> : <VideoOff size={18} />}
              <span>{camOn ? 'Camera' : 'Cam off'}</span>
            </button>
            <button className="controlBtn danger" onClick={leaveCall}>
              <LogOut size={18} />
              <span>Leave</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default CallRoom;
