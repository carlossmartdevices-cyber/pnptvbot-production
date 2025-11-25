# PNPtv Web Apps Setup Guide
## Using Agora App Builder Components

## 📦 Prerequisites

```bash
node >= 16.0.0
npm >= 8.0.0
```

---

## 🎥 Hangouts Web App (Video Calls + Rooms)

### Step 1: Create React App

```bash
cd /home/user/pnptvbot-production
mkdir web-apps
cd web-apps

# Create with Vite (faster than CRA)
npm create vite@latest hangouts-app -- --template react
cd hangouts-app
```

### Step 2: Install Agora Dependencies

```bash
# Core Agora packages
npm install agora-rtc-react agora-rtc-sdk-ng

# UI components (optional but recommended)
npm install @agora.io/app-builder-sdk

# Additional dependencies
npm install zustand react-router-dom
```

### Step 3: Configure Environment

Create `.env` file:

```env
VITE_AGORA_APP_ID=b68ab7b61ea44eabab7f242171311c5e
VITE_API_BASE_URL=https://yourdomain.com/api
```

### Step 4: Create Video Call Component

**`src/components/VideoCall.jsx`:**

```jsx
import { useState, useEffect } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  AgoraRTCProvider,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
  RemoteUser,
  LocalUser
} from 'agora-rtc-react';

const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

function VideoCall() {
  const [channelName, setChannelName] = useState('');
  const [token, setToken] = useState('');
  const [uid, setUid] = useState(0);
  const [joined, setJoined] = useState(false);

  // Get params from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlChannel = window.location.pathname.split('/').pop();

    if (urlToken && urlChannel) {
      setToken(urlToken);
      setChannelName(urlChannel);
    }
  }, []);

  return (
    <AgoraRTCProvider client={client}>
      <div className="video-call-container">
        <h1>PNPtv Hangouts</h1>
        {!joined ? (
          <JoinForm
            channelName={channelName}
            token={token}
            onJoin={() => setJoined(true)}
          />
        ) : (
          <CallView channelName={channelName} token={token} uid={uid} />
        )}
      </div>
    </AgoraRTCProvider>
  );
}

function JoinForm({ channelName, token, onJoin }) {
  return (
    <div className="join-form">
      <p>Channel: {channelName}</p>
      <button onClick={onJoin}>Join Call</button>
    </div>
  );
}

function CallView({ channelName, token, uid }) {
  // Join the channel
  useJoin({
    appid: import.meta.env.VITE_AGORA_APP_ID,
    channel: channelName,
    token: token,
    uid: uid,
  });

  // Get local tracks
  const { localMicrophoneTrack } = useLocalMicrophoneTrack();
  const { localCameraTrack } = useLocalCameraTrack();

  // Publish local tracks
  usePublish([localMicrophoneTrack, localCameraTrack]);

  // Get remote users
  const remoteUsers = useRemoteUsers();

  return (
    <div className="call-view">
      <div className="local-user">
        <LocalUser
          audioTrack={localMicrophoneTrack}
          videoTrack={localCameraTrack}
          cameraOn={true}
          micOn={true}
          playAudio={false}
          playVideo={true}
        />
        <p>You</p>
      </div>

      <div className="remote-users">
        {remoteUsers.map((user) => (
          <div key={user.uid} className="remote-user">
            <RemoteUser user={user} playAudio={true} playVideo={true} />
            <p>User {user.uid}</p>
          </div>
        ))}
      </div>

      <CallControls />
    </div>
  );
}

function CallControls() {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const toggleMic = () => setMicOn(!micOn);
  const toggleCam = () => setCamOn(!camOn);
  const leaveCall = () => window.location.href = '/';

  return (
    <div className="call-controls">
      <button onClick={toggleMic}>{micOn ? '🎤' : '🔇'}</button>
      <button onClick={toggleCam}>{camOn ? '📹' : '📷'}</button>
      <button onClick={leaveCall} className="leave-btn">Leave</button>
    </div>
  );
}

export default VideoCall;
```

### Step 5: Add Styling

**`src/App.css`:**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #1a1a2e;
  color: white;
}

.video-call-container {
  min-height: 100vh;
  padding: 20px;
}

.call-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
}

.local-user {
  width: 200px;
  height: 150px;
  position: absolute;
  top: 20px;
  right: 20px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #4a90e2;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.remote-users {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  flex: 1;
  padding: 20px;
}

.remote-user {
  background: #16213e;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 16/9;
  position: relative;
}

.remote-user p {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0,0,0,0.6);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
}

.call-controls {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  background: #0f3460;
  border-radius: 12px 12px 0 0;
}

.call-controls button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  font-size: 24px;
  cursor: pointer;
  background: #4a90e2;
  color: white;
  transition: all 0.3s;
}

.call-controls button:hover {
  transform: scale(1.1);
  background: #357abd;
}

.call-controls .leave-btn {
  background: #e74c3c;
  width: auto;
  padding: 0 30px;
  border-radius: 30px;
}

.call-controls .leave-btn:hover {
  background: #c0392b;
}
```

### Step 6: Main App Entry

**`src/App.jsx`:**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VideoCall from './components/VideoCall';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/call/:channelName" element={<VideoCall />} />
        <Route path="/room/:roomId" element={<VideoCall />} />
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>PNPtv Hangouts</h1>
      <p>Launch from Telegram to join a call</p>
    </div>
  );
}

export default App;
```

### Step 7: Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build

# Deploy to Netlify/Vercel
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

---

## 🎵 Radio Web App (Audio-only)

### Step 1: Create Radio App

```bash
cd /home/user/pnptvbot-production/web-apps
npm create vite@latest radio-app -- --template react
cd radio-app
npm install agora-rtc-react agora-rtc-sdk-ng
```

### Step 2: Radio Player Component

**`src/components/RadioPlayer.jsx`:**

```jsx
import { useState, useEffect } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  AgoraRTCProvider,
  useJoin,
  useRemoteAudioTracks,
} from 'agora-rtc-react';

const client = AgoraRTC.createClient({ mode: 'live', codec: 'opus' });

function RadioPlayer() {
  const [token, setToken] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (urlToken) {
      setToken(urlToken);
      fetchNowPlaying();
    }
  }, []);

  const fetchNowPlaying = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/radio/now-playing`);
      const data = await response.json();
      setNowPlaying(data.track);
    } catch (error) {
      console.error('Error fetching now playing:', error);
    }
  };

  return (
    <AgoraRTCProvider client={client}>
      <div className="radio-player">
        <div className="radio-header">
          <h1>🎵 PNPtv Radio</h1>
          <p className="live-badge">LIVE 24/7</p>
        </div>

        <div className="now-playing">
          {nowPlaying ? (
            <>
              <div className="album-art">
                {nowPlaying.thumbnailUrl ? (
                  <img src={nowPlaying.thumbnailUrl} alt={nowPlaying.title} />
                ) : (
                  <div className="placeholder">🎵</div>
                )}
              </div>
              <div className="track-info">
                <h2>{nowPlaying.title}</h2>
                <p className="artist">{nowPlaying.artist || 'Unknown Artist'}</p>
                <p className="type">{nowPlaying.type.toUpperCase()}</p>
              </div>
            </>
          ) : (
            <p>Loading...</p>
          )}
        </div>

        {token && (
          <AudioStream
            token={token}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
          />
        )}

        <div className="listener-count">
          <span>👥 123 listeners</span>
        </div>
      </div>
    </AgoraRTCProvider>
  );
}

function AudioStream({ token, isPlaying, onPlayPause }) {
  const channelName = 'pnptv_radio_247';

  // Join as audience (subscriber)
  useJoin(
    {
      appid: import.meta.env.VITE_AGORA_APP_ID,
      channel: channelName,
      token: token,
      uid: null,
    },
    isPlaying
  );

  // Play remote audio
  const { audioTracks } = useRemoteAudioTracks();

  useEffect(() => {
    audioTracks.forEach(track => track.play());
  }, [audioTracks]);

  return (
    <div className="player-controls">
      <button
        className="play-btn"
        onClick={onPlayPause}
      >
        {isPlaying ? '⏸️ Pause' : '▶️ Play'}
      </button>
    </div>
  );
}

export default RadioPlayer;
```

### Step 3: Radio Styling

**`src/App.css`:**

```css
.radio-player {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: white;
}

.radio-header {
  text-align: center;
  margin-bottom: 40px;
}

.radio-header h1 {
  font-size: 48px;
  margin-bottom: 10px;
}

.live-badge {
  background: #e74c3c;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  display: inline-block;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.now-playing {
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  max-width: 500px;
  margin-bottom: 30px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.album-art {
  width: 200px;
  height: 200px;
  margin: 0 auto 20px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  animation: rotate 20s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.album-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80px;
}

.track-info h2 {
  font-size: 24px;
  margin-bottom: 10px;
}

.artist {
  font-size: 18px;
  opacity: 0.8;
  margin-bottom: 10px;
}

.type {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
  background: rgba(255,255,255,0.2);
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
}

.player-controls {
  margin-bottom: 20px;
}

.play-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  background: white;
  color: #667eea;
  font-size: 32px;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  transition: all 0.3s;
}

.play-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 30px rgba(0,0,0,0.4);
}

.listener-count {
  background: rgba(0,0,0,0.3);
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
}
```

---

## 🚀 Deployment Guide

### Option 1: Netlify (Recommended)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy Hangouts app
cd hangouts-app
npm run build
netlify deploy --prod --dir=dist

# Deploy Radio app
cd ../radio-app
npm run build
netlify deploy --prod --dir=dist
```

### Option 2: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd hangouts-app
vercel --prod

cd ../radio-app
vercel --prod
```

### Option 3: Traditional Server (Nginx)

```bash
# Build both apps
cd hangouts-app && npm run build
cd ../radio-app && npm run build

# Copy to server
scp -r hangouts-app/dist user@server:/var/www/hangouts.pnptv.com
scp -r radio-app/dist user@server:/var/www/radio.pnptv.com
```

**Nginx config:**

```nginx
server {
    listen 443 ssl;
    server_name hangouts.pnptv.com;

    root /var/www/hangouts.pnptv.com;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 443 ssl;
    server_name radio.pnptv.com;

    root /var/www/radio.pnptv.com;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🔗 API Endpoints Needed

Create these in your backend:

```javascript
// GET /api/radio/now-playing
app.get('/api/radio/now-playing', async (req, res) => {
  const nowPlaying = await radioStreamManager.getNowPlaying();
  res.json(nowPlaying);
});

// GET /api/hangouts/room/:roomId
app.get('/api/hangouts/room/:roomId', async (req, res) => {
  const room = await MainRoomModel.getById(req.params.roomId);
  res.json(room);
});
```

---

## 📱 Testing URLs

After deployment:

**Hangouts:**
- https://hangouts.pnptv.com/call/test_channel?token=YOUR_TOKEN
- https://hangouts.pnptv.com/room/1?token=YOUR_TOKEN

**Radio:**
- https://radio.pnptv.com?token=YOUR_TOKEN

---

## ✅ Checklist

- [ ] Apps created with Vite
- [ ] Agora packages installed
- [ ] Components implemented
- [ ] Styling applied
- [ ] Environment variables set
- [ ] Apps built successfully
- [ ] Deployed to hosting
- [ ] Domains configured
- [ ] SSL certificates installed
- [ ] API endpoints working
- [ ] Tested from Telegram bot

---

## 🎨 Customization with App Builder

Use the Components API you shared to add:

- **Custom layouts:** Grid, spotlight, carousel
- **Branding:** Logo, colors, fonts
- **Chat:** Built-in messaging
- **Screen sharing:** One-click sharing
- **Recording:** Cloud recording controls
- **Polls:** Interactive polls in webinars
- **Virtual backgrounds:** Background replacement
- **Beauty filters:** Face enhancement

See: https://appbuilder-docs.agora.io/customization-api/api-reference/components-api

---

**Your web apps are now ready to deploy!** 🚀
