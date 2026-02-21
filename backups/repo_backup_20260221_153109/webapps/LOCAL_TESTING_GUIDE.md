# 🧪 Local Testing Guide for PNPtv Web Apps

This guide will help you test all three web apps locally before deploying to production.

## ✅ Prerequisites Check

All dependencies installed successfully:
- ✅ Hangouts: 197 packages installed
- ✅ Radio: Dependencies installed
- ✅ Live: Dependencies installed

## 🚀 Quick Start - Test Each App

### 1. Test Hangouts (Video Conferencing)

#### Terminal 1: Start Hangouts Dev Server
```bash
cd /home/user/pnptvbot-production/webapps/hangouts
npm run dev
```

**Expected Output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

#### Test URLs:

**Test 1: Basic Load**
```
http://localhost:3000
```
❌ Should show error: "Missing required parameters"
✅ This is correct! It means the app is working.

**Test 2: With Mock Parameters**
```
http://localhost:3000?room=test_room&token=mock_token_123&uid=123&username=TestUser&type=main
```
✅ Should load the video interface
⚠️ Will show Agora connection error (normal without valid token)
✅ UI should be visible with controls

**Test 3: Private Call**
```
http://localhost:3000?room=private_call_456&token=mock_token&uid=456&username=JohnDoe&type=private
```

#### What to Check:
- ✅ App loads without JavaScript errors
- ✅ Video container visible
- ✅ Controls visible (mic, video, screen share, hang up)
- ✅ Header shows room info
- ✅ Participants button works
- ✅ Settings button works
- ⚠️ Agora error is expected (need real token)

**Stop Server:** Press `Ctrl+C`

---

### 2. Test Radio (Audio Streaming)

#### Terminal 2: Start Radio Dev Server
```bash
cd /home/user/pnptvbot-production/webapps/radio
npm run dev -- --port 3001
```

**Expected Output:**
```
➜  Local:   http://localhost:3001/
```

#### Test URLs:

**Test 1: Basic Radio Interface**
```
http://localhost:3001
```
✅ Should load beautiful gradient UI
✅ Should show "PNPtv Radio"
✅ Play button visible
✅ Volume controls visible

**Test 2: With Parameters**
```
http://localhost:3001?room=pnptv_radio&token=mock&uid=789
```

#### What to Check:
- ✅ Gradient background loads correctly
- ✅ "LIVE" badge pulsing
- ✅ Now Playing section visible
- ✅ Play/Pause button works (UI toggle)
- ✅ Volume slider functional
- ✅ Listener count displays
- ⚠️ Audio won't play (need real Agora token)

**Stop Server:** Press `Ctrl+C`

---

### 3. Test Live (Broadcasting)

#### Terminal 3: Start Live Dev Server
```bash
cd /home/user/pnptvbot-production/webapps/live
npm run dev -- --port 3002
```

**Expected Output:**
```
➜  Local:   http://localhost:3002/
```

#### Test URLs:

**Test 1: Viewer Mode**
```
http://localhost:3002?stream=live_123&token=mock&uid=101&username=Viewer1&role=audience
```
✅ Should load as viewer
✅ Chat panel visible
✅ "Waiting for host" message

**Test 2: Host Mode**
```
http://localhost:3002?stream=live_456&token=mock&uid=202&username=Host1&role=host
```
✅ Should load with broadcast controls
✅ Mic/Video/End Stream buttons visible
✅ Chat toggle works

#### What to Check:
- ✅ Dark theme loads correctly
- ✅ Live badge visible
- ✅ Viewer count shows
- ✅ Chat panel opens/closes
- ✅ Controls appropriate for role (host vs viewer)
- ✅ Message input works (UI only)
- ⚠️ Video won't start (need real Agora token)

**Stop Server:** Press `Ctrl+C`

---

## 🔍 Browser Console Testing

Open Developer Tools (F12) and check:

### Expected Console Output (All Apps):
```
✅ No JavaScript syntax errors
⚠️ Agora SDK errors are EXPECTED with mock tokens:
   - "INVALID_TOKEN"
   - "JOIN_CHANNEL_FAILED"
   - This is normal for local testing
```

### Red Flags (Fix if you see these):
```
❌ "Cannot find module..."
❌ "Unexpected token"
❌ "Failed to compile"
❌ 404 errors for assets
```

---

## 🎨 Visual Testing Checklist

### Hangouts (/hangouts)
- [ ] Clean dark UI with video container
- [ ] Control buttons in a row at bottom
- [ ] Circular buttons with icons
- [ ] Header with room info
- [ ] Responsive layout
- [ ] No visual glitches

### Radio (/radio)
- [ ] Beautiful purple gradient background
- [ ] Centered player card
- [ ] Smooth blur effect on card
- [ ] Pulsing "LIVE" badge
- [ ] Large play button
- [ ] Volume slider works smoothly

### Live (/live)
- [ ] Full-screen dark layout
- [ ] Live badge in header
- [ ] Viewer count visible
- [ ] Chat panel on right (or bottom on mobile)
- [ ] Broadcast controls visible
- [ ] Professional streaming interface

---

## 🧪 Interactive Testing

### Test Hangouts Controls:
1. Click **Mic button** → Should toggle red/green
2. Click **Video button** → Should toggle red/green
3. Click **Screen Share** → Browser permission popup (cancel is fine)
4. Click **Participants** → List should appear on right
5. Click **Settings** → Settings panel should appear
6. Click **Hang Up** → Window should close or show confirmation

### Test Radio Controls:
1. Click **Play button** → Should show Pause icon
2. Click **Pause** → Should show Play icon
3. Drag **Volume slider** → Value should change smoothly
4. Click **Mute/Unmute** icon → Should toggle

### Test Live Controls:
1. Toggle **Chat panel** → Should show/hide smoothly
2. Type in **chat input** → Can type message
3. Click **Send** → Message appears in chat (local only)
4. Host: Click **Mic/Video** → Should toggle state
5. Click **End Stream** → Should attempt to close

---

## 📊 Performance Testing

### Check Load Times:
```bash
# Open browser DevTools → Network tab
# Reload each app

Expected:
- Initial load: < 2 seconds
- JavaScript bundle: < 500KB
- CSS: < 50KB
- Total page size: < 1MB
```

### Check for Memory Leaks:
```bash
# Browser DevTools → Performance tab
# Record for 10 seconds
# Check memory doesn't continuously increase
```

---

## 🔧 Testing with Backend

### Option 1: Update .env for Local Testing
```bash
# Edit /home/user/pnptvbot-production/.env
nano .env

# Add these lines:
HANGOUTS_WEB_URL=http://localhost:3000
RADIO_WEB_URL=http://localhost:3001
LIVE_WEB_URL=http://localhost:3002
```

### Option 2: Restart Bot
```bash
pm2 restart pnptvbot
```

### Option 3: Test via Telegram
1. Open Telegram bot
2. Go to Hangouts
3. Join Main Room
4. Should open `http://localhost:3000` with REAL token
5. Video should actually work! 🎉

**IMPORTANT:** Remember to change URLs back to production before deploying:
```bash
HANGOUTS_WEB_URL=https://pnptv.app/hangouts
RADIO_WEB_URL=https://pnptv.app/radio
LIVE_WEB_URL=https://pnptv.app/live
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot find module 'react'"
```bash
# Solution: Reinstall dependencies
cd webapps/hangouts
rm -rf node_modules package-lock.json
npm install
```

### Issue 2: Port already in use
```bash
# Solution: Use different port
npm run dev -- --port 3003

# Or kill process using port
lsof -ti:3000 | xargs kill
```

### Issue 3: Blank screen
```bash
# Check browser console for errors
# Check if dev server is running
# Try clearing browser cache (Ctrl+Shift+R)
```

### Issue 4: Styles not loading
```bash
# Ensure index.css exists
# Check browser Network tab for 404s
# Hard refresh (Ctrl+Shift+R)
```

### Issue 5: Agora errors
```
✅ NORMAL for local testing with mock tokens
✅ Will work with real tokens from bot
⚠️ If errors persist with real tokens, check:
   - AGORA_APP_ID in .env
   - AGORA_CERTIFICATE in .env
   - Token expiration
```

---

## ✅ Testing Checklist

Before deploying to production, verify:

### All Apps Load:
- [ ] Hangouts loads at localhost:3000
- [ ] Radio loads at localhost:3001
- [ ] Live loads at localhost:3002

### No Console Errors:
- [ ] No JavaScript syntax errors
- [ ] No missing module errors
- [ ] No 404 errors (except expected Agora errors)

### UI Works:
- [ ] All buttons visible and clickable
- [ ] Styles load correctly
- [ ] Responsive on different screen sizes
- [ ] No visual glitches

### Controls Function:
- [ ] All toggles work (UI level)
- [ ] Inputs accept text
- [ ] Panels show/hide correctly

### Production Build:
- [ ] `npm run build` succeeds for all apps
- [ ] Build outputs to `dist/` folder
- [ ] No build errors or warnings (except peer dependency warnings)

---

## 🎯 Next: Production Build Test

Once local testing passes, build for production:

```bash
# Test production builds
cd /home/user/pnptvbot-production/webapps/hangouts
npm run build
ls -lh dist/

cd ../radio
npm run build
ls -lh dist/

cd ../live
npm run build
ls -lh dist/
```

**Expected Output:**
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js    (main bundle)
│   └── index-[hash].css   (styles)
└── vite.svg

Total size: ~500KB - 1MB per app
```

---

## 📱 Mobile Testing (Optional)

To test on mobile devices:

```bash
# Start dev server with host flag
npm run dev -- --host

# Access from phone using computer's IP
http://192.168.x.x:3000
```

---

## 🎉 Success Criteria

Your local testing is successful if:

✅ All 3 apps load without errors
✅ UIs render correctly with proper styling
✅ Controls are interactive (even if features don't work yet)
✅ No JavaScript console errors (except Agora token errors)
✅ Production builds complete successfully
✅ App works with real tokens via Telegram bot

---

## 🚀 After Local Testing

Once everything works locally:

1. ✅ **Commit any fixes** (if you made changes)
2. ✅ **Deploy to staging** (Netlify/Vercel)
3. ✅ **Test with real Agora tokens**
4. ✅ **Deploy to production** (pnptv.app)
5. ✅ **Update bot .env** with production URLs
6. ✅ **Test via Telegram bot**

---

**Ready to start testing?** Just run:
```bash
cd /home/user/pnptvbot-production/webapps/hangouts
npm run dev
```

Then open http://localhost:3000 in your browser! 🎊
