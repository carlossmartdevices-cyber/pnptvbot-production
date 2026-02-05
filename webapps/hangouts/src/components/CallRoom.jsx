import { useEffect, useRef, useState } from 'react';
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
  const [agoraReady, setAgoraReady] = useState(false);

  const prejoinVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const agoraRef = useRef(null);

  const isMainRoom = params.type === 'main';
  const mode = isMainRoom ? 'live' : 'rtc';
  const canPublish = !isMainRoom;
  const resolvedAppId = params.appId || import.meta.env.VITE_AGORA_APP_ID || '';

  useEffect(() => {
    stripQueryParams();
  }, []);

  useEffect(() => {
    let active = true;

    const loadAgora = async () => {
      setStatus('Loading video engine...');
      try {
        const module = await import('agora-rtc-sdk-ng');
        if (!active) return;
        agoraRef.current = module.default || module;
        setAgoraReady(true);
        setStatus('');
      } catch (error) {
        if (active) {
          setStatus('Failed to load video engine.');
        }
      }
    };

    loadAgora();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!agoraReady || !agoraRef.current) return;
    const AgoraRTC = agoraRef.current;
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
  }, [mode, agoraReady]);

  const ensureLocalTracks = async () => {
    const AgoraRTC = agoraRef.current;
    if (!AgoraRTC) throw new Error('Video engine not ready.');
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
    const AgoraRTC = agoraRef.current;
    if (!AgoraRTC) return;
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
      if (!agoraReady || !agoraRef.current) {
        throw new Error('Video engine is still loading. Please try again.');
      }
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
        <div className="card max-w-lg mx-auto my-8 p-6">
          <h2 className="hero-title text-center">Confirm before entering</h2>
          <p className="hero-text text-center mt-2">Nothing starts until you confirm.</p>
          <div className="form-group space-y-3 my-6">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded"
              />
              <span>I confirm I am 18+ (or legal age in my country).</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={privacyConfirmed}
                onChange={(event) => setPrivacyConfirmed(event.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded"
              />
              <span>I understand this is private content and will not record.</span>
            </label>
          </div>
          <div className="flex gap-4 mt-6">
            <button
              className="button"
              onClick={handleConsent}
              disabled={!ageConfirmed || !privacyConfirmed}
            >
              Continue
            </button>
            <button className="button button-secondary" onClick={() => window.close()}>
              Exit
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Tip: open in a private window and keep your link secret.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">
            <ShieldCheck size={18} />
          </div>
          <div className="header-text">
            <h1>PNPtv Hangouts</h1>
            <p>
              {params.type} | {privacyMode ? 'Privacy On' : 'Privacy Off'} | 18+
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`button-icon ${privacyMode ? 'active' : ''}`}
            onClick={() => setPrivacyMode((prev) => !prev)}
            aria-label="Toggle privacy mode"
            title="Toggle privacy mode"
          >
            <ShieldCheck size={18} />
          </button>
          <button className="button-icon button-danger" onClick={leaveCall} title="Exit">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="container call-body">
        <section className="hero-section text-center">
          <h2 className="hero-title">
            {callStartedAt ? 'You are live' : 'Ready when you are'}
          </h2>
          <p className="hero-text">
            {callStartedAt
              ? `Room is active. ${remoteUsers.length} online.`
              : 'Choose what to share before joining.'}
          </p>

          {!callStartedAt && (
            <div className="card">
              <div className="relative w-full h-48 bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <div ref={prejoinVideoRef} className="w-full h-full object-cover" />
                {!camOn && <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center text-muted-foreground">Camera preview is off</div>}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Mic</div>
                  <div className="text-lg font-semibold">{micOn ? 'On' : 'Off'}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Mode</div>
                  <div className="text-lg font-semibold">{canPublish ? 'Speaker' : 'Audience'}</div>
                </div>
              </div>

              <div className="segmented-control mt-4">
                <button
                  className={`segmented-control-button ${micOn ? 'active' : ''}`}
                  onClick={() => setMicOn((prev) => !prev)}
                  type="button"
                >
                  {micOn ? <Mic size={16} /> : <MicOff size={16} />} Mic
                </button>
                <button
                  className={`segmented-control-button ${camOn ? 'active' : ''}`}
                  onClick={() => setCamOn((prev) => !prev)}
                  type="button"
                >
                  {camOn ? <Camera size={16} /> : <VideoOff size={16} />} Camera
                </button>
              </div>

              <div className="flex gap-4 mt-6">
                <button className="button" onClick={joinCall} disabled={joining}>
                  {joining ? 'Joining...' : 'Join now'}
                </button>
                <button className="button button-secondary" onClick={leaveCall}>
                  Exit
                </button>
              </div>
            </div>
          )}

          {callStartedAt && (
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <span className="badge">
                <Users size={14} /> {remoteUsers.length + 1} participants
              </span>
              <span className="badge badge-subtle">
                Live for {formatElapsed(Date.now() - callStartedAt)}
              </span>
              <button className="button-link" onClick={copyLink}>
                <Link2 size={14} /> Copy link
              </button>
            </div>
          )}
        </section>

        {status && <div className="alert alert-info">{status}</div>}

        {callStartedAt && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <div className="w-full h-full object-cover" ref={localVideoRef} />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                {privacyMode ? 'You' : telegramUser?.displayName || params.username}
              </div>
            </div>
            {remoteUsers.map((user) => (
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video" key={user.uid}>
                <div className="w-full h-full object-cover" id={`remote-${user.uid}`} />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  {privacyMode ? 'Guest' : `User ${user.uid}`}
                </div>
              </div>
            ))}
          </section>
        )}

        {callStartedAt && (
          <div className="control-bar fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex justify-center gap-4">
            <button className="button-icon button-lg" onClick={() => setMicOn((prev) => !prev)}>
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
              <span>{micOn ? 'Mute' : 'Unmute'}</span>
            </button>
            <button className="button-icon button-lg" onClick={() => setCamOn((prev) => !prev)}>
              {camOn ? <Video size={18} /> : <VideoOff size={18} />}
              <span>{camOn ? 'Camera' : 'Cam off'}</span>
            </button>
            <button className="button-icon button-lg button-danger" onClick={leaveCall}>
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