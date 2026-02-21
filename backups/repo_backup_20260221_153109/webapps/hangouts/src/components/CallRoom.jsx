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
      <div className="flex items-center justify-center min-h-screen bg-color">
        <div className="w-full max-w-md p-8 space-y-6 bg-color-2 rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Confirm before entering</h2>
            <p className="mt-2 text-muted-color">Nothing starts until you confirm.</p>
          </div>
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary-color focus:ring-primary-color"
              />
              <span className="text-color">I confirm I am 18+ (or legal age in my country).</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={privacyConfirmed}
                onChange={(event) => setPrivacyConfirmed(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary-color focus:ring-primary-color"
              />
              <span className="text-color">I understand this is private content and will not record.</span>
            </label>
          </div>
          <div className="flex gap-4 pt-4">
            <button
              className="btn btn-primary w-full"
              onClick={handleConsent}
              disabled={!ageConfirmed || !privacyConfirmed}
            >
              Continue
            </button>
            <button className="btn btn-secondary w-full" onClick={() => window.close()}>
              Exit
            </button>
          </div>
          <p className="text-xs text-muted-color text-center pt-2">
            Tip: open in a private window and keep your link secret.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-color text-color">
      <header className="header">
        <div className="header-logo">
          <h1>PNPtv Hangouts</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            className={`btn btn-sm ${privacyMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPrivacyMode((prev) => !prev)}
            aria-label="Toggle privacy mode"
            title="Toggle privacy mode"
          >
            <ShieldCheck size={16} className="mr-2" />
            {privacyMode ? 'Privacy On' : 'Privacy Off'}
          </button>
          <button className="btn btn-destructive btn-sm" onClick={leaveCall} title="Exit">
            <LogOut size={16} className="mr-2" /> Exit
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-4">
        {!callStartedAt ? (
          <div className="w-full max-w-lg mx-auto">
            <div className="bg-color-2 p-6 rounded-lg shadow-md text-center">
              <h2 className="text-2xl font-bold mb-2">Ready when you are</h2>
              <p className="text-muted-color mb-6">Choose what to share before joining.</p>
              
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <div ref={prejoinVideoRef} className="w-full h-full object-cover" />
                {!camOn && <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-muted-color">Camera preview is off</div>}
              </div>

              <div className="flex justify-center gap-4 mb-6">
                <button
                  className={`btn ${micOn ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMicOn((prev) => !prev)}
                >
                  {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button
                  className={`btn ${camOn ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCamOn((prev) => !prev)}
                >
                  {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
              </div>

              <button className="btn btn-primary w-full" onClick={joinCall} disabled={joining}>
                {joining ? 'Joining...' : 'Join now'}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <div className="w-full h-full object-cover" ref={localVideoRef} />
                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {privacyMode ? 'You' : telegramUser?.displayName || params.username}
                </div>
              </div>
              {remoteUsers.map((user) => (
                <div className="relative bg-black rounded-lg overflow-hidden" key={user.uid}>
                  <div className="w-full h-full object-cover" id={`remote-${user.uid}`} />
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {privacyMode ? 'Guest' : `User ${user.uid}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {callStartedAt && (
        <footer className="flex justify-center items-center gap-4 p-4 bg-color-2 border-t border-color">
          <button className="btn btn-secondary" onClick={() => setMicOn((prev) => !prev)}>
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button className="btn btn-secondary" onClick={() => setCamOn((prev) => !prev)}>
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <button className="btn btn-destructive" onClick={leaveCall}>
            <LogOut size={20} />
          </button>
        </footer>
      )}

      {status && (
        <div className="fixed top-20 right-8 bg-color-2 text-color px-6 py-3 rounded-lg shadow-lg animate-fade-in-out">
          {status}
        </div>
      )}
    </div>
  );
}

export default CallRoom;