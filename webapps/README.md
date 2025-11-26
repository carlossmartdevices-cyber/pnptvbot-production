# PNPtv Web Applications

Complete React-based web applications for PNPtv's Hangouts, Radio, and Live features.

## 🎯 Features

### 🎥 Hangouts (`/hangouts`)
- **Video Conferencing**: HD video calls with Agora RTC
- **Main Room**: Public video chat room
- **Private Calls**: Create private video calls with call IDs
- **Screen Sharing**: Share your screen with participants
- **Audio/Video Controls**: Mute, unmute, camera on/off
- **Participant Management**: See who's in the call

### 🎵 Radio (`/radio`)
- **Live Audio Streaming**: 24/7 radio stream
- **Now Playing**: Real-time track information
- **Volume Control**: Adjust listening volume
- **Listener Count**: See how many people are listening
- **Beautiful UI**: Gradient design with smooth animations

### 📺 Live (`/live`)
- **Live Broadcasting**: Stream video to audience
- **Host/Viewer Modes**: Broadcast or watch
- **Real-time Chat**: Live chat during streams
- **Viewer Count**: Track audience size
- **Broadcast Controls**: Mute, camera, end stream

## 🛠️ Technology Stack

- **Frontend**: React 18 + Vite
- **Streaming**: Agora RTC SDK
- **Styling**: Custom CSS
- **Icons**: Lucide React
- **Build**: Vite (fast, modern bundler)

## 📦 Project Structure

```
webapps/
├── hangouts/              # Video conferencing app
│   ├── src/
│   │   ├── components/
│   │   │   └── VideoCall.jsx
│   │   ├── utils/
│   │   │   └── url.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── netlify.toml
│   └── vercel.json
│
├── radio/                 # Radio streaming app
│   ├── src/
│   │   ├── components/
│   │   │   └── RadioPlayer.jsx
│   │   ├── utils/
│   │   │   └── url.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── ...
│
├── live/                  # Live broadcasting app
│   ├── src/
│   │   ├── components/
│   │   │   └── LiveStream.jsx
│   │   ├── utils/
│   │   │   └── url.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── ...
│
├── DEPLOYMENT.md          # Deployment guide
├── AI_AGENT_INTEGRATION.md # AI features guide
└── README.md              # This file
```

## 🚀 Quick Start

### Development

```bash
# Install dependencies for all apps
cd webapps
for app in hangouts radio live; do
  cd $app
  npm install
  cd ..
done

# Run Hangouts app (port 3000)
cd hangouts
npm run dev

# Run Radio app (port 3001)
cd radio
npm run dev -- --port 3001

# Run Live app (port 3002)
cd live
npm run dev -- --port 3002
```

### Production Build

```bash
# Build all apps
for app in hangouts radio live; do
  cd webapps/$app
  npm install
  npm run build
  cd ../..
done
```

## 🔧 Configuration

### Environment

Each app receives configuration via URL parameters:

**Hangouts**:
```
https://pnptv.app/hangouts?room=main_room_123&token=xxx&uid=456&username=John&type=main&appId=xxx
```

**Radio**:
```
https://pnptv.app/radio?room=pnptv_radio&token=xxx&uid=789&appId=xxx
```

**Live**:
```
https://pnptv.app/live?stream=live_stream_123&token=xxx&uid=101&username=Jane&role=host&appId=xxx
```

### Backend Configuration

Update `.env`:
```bash
HANGOUTS_WEB_URL=https://pnptv.app/hangouts
RADIO_WEB_URL=https://pnptv.app/radio
LIVE_WEB_URL=https://pnptv.app/live
AGORA_APP_ID=b68ab7b61ea44eabab7f242171311c5e
AGORA_CERTIFICATE=your_certificate_here
```

## 📋 Requirements

### Backend Setup
1. ✅ Agora account with App ID
2. ✅ Agora Certificate (for token generation)
3. ✅ Database schema deployed
4. ✅ Bot handlers configured
5. ✅ Models and services in place

### Deployment Requirements
- Node.js 18+
- npm or yarn
- Web server (Netlify/Vercel/nginx)
- SSL certificate (HTTPS required for media devices)
- Domain: pnptv.app

## 🎨 Customization

### Styling

Each app has its own `index.css` with custom styling. Modify colors, layouts, etc.:

```css
/* webapps/hangouts/src/index.css */
body {
  background: #0f0f0f;  /* Change background */
}

.control-btn.active {
  background: #4CAF50;  /* Change accent color */
}
```

### Features

Add new features to components:

```javascript
// webapps/hangouts/src/components/VideoCall.jsx
const VideoCall = ({ ...props }) => {
  // Add custom features
  const [customFeature, setCustomFeature] = useState(false)

  // Implement feature
  const handleCustomFeature = () => {
    // Your code here
  }

  // Add to UI
  return (
    <>
      {/* Existing UI */}
      <button onClick={handleCustomFeature}>Custom Feature</button>
    </>
  )
}
```

## 🧪 Testing

### Local Testing

1. **Start all apps**:
   ```bash
   # Terminal 1
   cd webapps/hangouts && npm run dev

   # Terminal 2
   cd webapps/radio && npm run dev -- --port 3001

   # Terminal 3
   cd webapps/live && npm run dev -- --port 3002
   ```

2. **Test with bot**:
   - Update `.env` with local URLs:
     ```bash
     HANGOUTS_WEB_URL=http://localhost:3000
     RADIO_WEB_URL=http://localhost:3001
     LIVE_WEB_URL=http://localhost:3002
     ```
   - Restart bot: `pm2 restart pnptvbot`
   - Test features in Telegram

3. **Manual Testing**:
   - Open `http://localhost:3000?room=test&token=test&uid=123`
   - Check console for errors
   - Test all controls

### Production Testing

After deployment:
1. Test each feature through Telegram bot
2. Verify camera/microphone permissions
3. Test on different devices/browsers
4. Check WebRTC connection quality
5. Monitor Agora dashboard for usage

## 📊 Monitoring

### Agora Dashboard
- https://console.agora.io
- Monitor active channels
- View usage statistics
- Check quality metrics

### Browser Console
- Check for JavaScript errors
- Monitor WebRTC connection status
- View Agora SDK logs

### Server Logs
```bash
# nginx access logs
sudo tail -f /var/log/nginx/access.log | grep "hangouts\|radio\|live"

# Bot logs
pm2 logs pnptvbot --lines 50
```

## 🔐 Security

### Best Practices

1. **HTTPS Only**: Always use HTTPS in production
2. **Token Expiry**: Tokens expire after 24 hours
3. **Validate Tokens**: Backend validates all tokens
4. **User Authentication**: Verify users via Telegram
5. **Rate Limiting**: Prevent abuse

### CORS Configuration

If hosting separately:

```javascript
// vite.config.js
export default defineConfig({
  server: {
    cors: {
      origin: ['https://pnptv.app', 'https://t.me'],
      credentials: true,
    },
  },
})
```

## 🐛 Troubleshooting

### Common Issues

**Camera/Mic not working**:
- Ensure HTTPS (required for media devices)
- Check browser permissions
- Verify Agora credentials

**Token errors**:
- Check Agora Certificate
- Verify token generation
- Check token expiration

**Build errors**:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Connection failed**:
- Check Agora App ID
- Verify network allows WebRTC
- Check firewall settings

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [AI Agent Integration](./AI_AGENT_INTEGRATION.md)
- [Agora RTC Docs](https://docs.agora.io)
- [React Docs](https://react.dev)

## 🎯 Next Steps

1. ✅ Deploy apps to pnptv.app
2. ✅ Get Agora Certificate
3. ✅ Test all features
4. ⏳ Add AI agents (optional)
5. ⏳ Configure analytics
6. ⏳ Gather user feedback

## 💡 Tips

- Start with Hangouts, then Radio, then Live
- Test locally before deploying
- Use Netlify/Vercel for easy deployment
- Monitor Agora usage to avoid quota limits
- Keep dependencies updated

## 🤝 Contributing

When adding features:
1. Test locally first
2. Follow existing code style
3. Update documentation
4. Build and test production build
5. Submit changes

## 📞 Support

For issues:
- Check browser console for errors
- Review Agora dashboard
- Check bot logs: `pm2 logs pnptvbot`
- Test with known good configuration

---

**Built with ❤️ for PNPtv**

Powered by:
- [Agora RTC](https://www.agora.io)
- [React](https://react.dev)
- [Vite](https://vitejs.dev)
