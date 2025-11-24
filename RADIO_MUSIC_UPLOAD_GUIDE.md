# PNPtv Radio - Music Upload & Streaming Guide

## 🎵 How to Upload and Stream Music

The radio interface at `https://easybots.store/radio.html` plays from the stream URL configured at:
```
https://pnptv.app/radio/stream
```

To upload and stream music, you need to set up a streaming server.

---

## ✅ Option 1: Icecast Server (Recommended - Open Source)

### Step 1: Install Icecast
```bash
sudo apt update
sudo apt install icecast2
```

During installation:
- Hostname: `pnptv.app`
- Source password: `[choose_secure_password]`
- Relay password: `[choose_secure_password]`
- Admin password: `[choose_secure_password]`

### Step 2: Configure Icecast
Edit config:
```bash
sudo nano /etc/icecast2/icecast.xml
```

Update these settings:
```xml
<hostname>pnptv.app</hostname>
<listen-socket>
    <port>8000</port>
    <bind-address>127.0.0.1</bind-address>
</listen-socket>

<authentication>
    <source-password>Apelo801050%</source-password>
    <relay-password>YOUR_RELAY_PASSWORD</relay-password>
    <admin-user>admin</admin-user>
    <admin-password>YOUR_ADMIN_PASSWORD</admin-password>
</authentication>

<paths>
    <logdir>/var/log/icecast2</logdir>
    <webroot>/usr/share/icecast2/web</webroot>
    <adminroot>/usr/share/icecast2/admin</adminroot>
</paths>
```

### Step 3: Enable and Start Icecast
```bash
sudo systemctl enable icecast2
sudo systemctl start icecast2
sudo systemctl status icecast2
```

### Step 4: Configure Nginx Proxy
Add to `/etc/nginx/sites-available/pnptv-bot.conf`:

```nginx
# Radio Stream Proxy
location /radio/stream {
    proxy_pass http://127.0.0.1:8000/pnptv;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    
    # Headers for streaming
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
    add_header Access-Control-Allow-Origin "*";
    
    # Logging
    access_log /var/log/nginx/radio-stream-access.log combined;
}

# Radio Admin (optional)
location /radio/admin {
    proxy_pass http://127.0.0.1:8000/admin/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    auth_basic "Radio Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

Reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Upload Music via Source Client

Install **Liquidsoap** (broadcasting software):
```bash
sudo apt install liquidsoap
```

Create a playlist directory:
```bash
mkdir -p /var/radio/music
mkdir -p /var/radio/playlists
```

Upload your music:
```bash
# Via SCP from your computer
scp your-music.mp3 root@easybots.store:/var/radio/music/

# Or via wget
wget -P /var/radio/music/ https://example.com/song.mp3
```

Create a playlist:
```bash
# Create M3U playlist
ls /var/radio/music/*.mp3 > /var/radio/playlists/main.m3u
```

### Step 6: Configure Liquidsoap
Create liquidsoap script:
```bash
nano /etc/liquidsoap/radio.liq
```

Add:
```liquidsoap
#!/usr/bin/liquidsoap

# Log
set("log.file.path", "/var/log/liquidsoap/pnptv.log")
set("log.stdout", true)

# Create audio source from playlist
music = playlist(mode="randomize", reload=3600, "/var/radio/playlists/main.m3u")

# Normalize audio
music = normalize(music)

# Add crossfade
music = crossfade(music)

# Output to Icecast
output.icecast(
  %mp3(bitrate=128),
  host = "127.0.0.1",
  port = 8000,
  password = "YOUR_SOURCE_PASSWORD",
  mount = "pnptv",
  name = "PNPtv Radio",
  description = "PNPtv 24/7 Streaming",
  url = "https://pnptv.app",
  music
)
```

Create systemd service:
```bash
sudo nano /etc/systemd/system/pnptv-radio.service
```

Add:
```ini
[Unit]
Description=PNPtv Radio Liquidsoap
After=network.target icecast2.service

[Service]
Type=simple
User=liquidsoap
Group=liquidsoap
ExecStart=/usr/bin/liquidsoap /etc/liquidsoap/radio.liq
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pnptv-radio
sudo systemctl start pnptv-radio
sudo systemctl status pnptv-radio
```

---

## ✅ Option 2: Azuracast (All-in-One Solution)

Azuracast provides a complete web interface for managing radio stations.

### Installation:
```bash
cd /var
sudo mkdir azuracast
cd azuracast
curl -fsSL https://raw.githubusercontent.com/AzuraCast/AzuraCast/main/docker.sh > docker.sh
chmod +x docker.sh
sudo ./docker.sh install
```

Access at: `http://your-server-ip`

Setup wizard will guide you through:
1. Create admin account
2. Create station (PNPtv)
3. Configure stream (mountpoint: /pnptv)
4. Upload music via web interface
5. Create playlists
6. Start broadcasting

Then update nginx to proxy to Azuracast:
```nginx
location /radio/stream {
    proxy_pass http://127.0.0.1:8000/radio/8000/pnptv;
    proxy_buffering off;
}
```

---

## ✅ Option 3: Use External Streaming Service

### Popular Services:
- **Radio.co** - https://radio.co
- **Shoutcast** - https://shoutcast.com
- **Live365** - https://live365.com

Steps:
1. Sign up for service
2. Upload your music library
3. Create playlists
4. Get your stream URL
5. Update `radio.html` with your stream URL:

Edit `/root/pnptvbot-production/public/radio.html` lines 668-673:
```javascript
currentStreamUrl = 'YOUR_STREAM_URL_HERE';
```

Restart bot:
```bash
pm2 restart pnptv-bot
```

---

## 🎛️ Quick Music Management

### Add Songs:
```bash
# Copy music to directory
cp /path/to/song.mp3 /var/radio/music/

# Update playlist
ls /var/radio/music/*.mp3 > /var/radio/playlists/main.m3u

# Reload liquidsoap (picks up new songs automatically after 1 hour)
# Or force reload:
sudo systemctl restart pnptv-radio
```

### Remove Songs:
```bash
rm /var/radio/music/unwanted-song.mp3
ls /var/radio/music/*.mp3 > /var/radio/playlists/main.m3u
```

### Check Stream Status:
```bash
# Icecast stats
curl http://127.0.0.1:8000/status-json.xsl

# Liquidsoap logs
tail -f /var/log/liquidsoap/pnptv.log

# Icecast logs
tail -f /var/log/icecast2/access.log
```

### Test Stream:
```bash
# From command line
ffplay https://pnptv.app/radio/stream

# Or open in browser
curl -I https://pnptv.app/radio/stream
```

---

## 📊 Recommended Setup for Production

**Best Architecture:**
```
[Music Files] → [Liquidsoap] → [Icecast] → [Nginx SSL Proxy] → [Users]
     ↓
[M3U Playlists]
```

**Advantages:**
- ✅ 24/7 automated streaming
- ✅ Randomized playback
- ✅ Crossfade between songs
- ✅ Audio normalization
- ✅ Auto-reload playlists
- ✅ Multiple mount points support
- ✅ SSL/HTTPS streaming
- ✅ Listener statistics

---

## 🎵 Music Format Recommendations

**Supported Formats:**
- MP3 (recommended: 128-320 kbps)
- AAC/M4A
- OGG Vorbis
- FLAC (will be transcoded)

**Optimal Settings:**
- Bitrate: 128 kbps (good quality, lower bandwidth)
- Sample Rate: 44.1 kHz
- Channels: Stereo

**Convert files if needed:**
```bash
# Install ffmpeg
sudo apt install ffmpeg

# Convert to MP3 128kbps
ffmpeg -i input.flac -b:a 128k -ar 44100 output.mp3

# Batch convert
for file in *.flac; do
    ffmpeg -i "$file" -b:a 128k -ar 44100 "${file%.flac}.mp3"
done
```

---

## 🚀 Quick Start (Fastest Method)

If you just want to test quickly:

1. **Install Icecast:**
```bash
sudo apt install icecast2
sudo systemctl start icecast2
```

2. **Upload one song and stream with ffmpeg:**
```bash
ffmpeg -re -i /path/to/song.mp3 -f mp3 \
  -ice_genre "Latin Music" -ice_name "PNPtv Radio" \
  -ice_description "PNPtv Streaming" \
  -content_type audio/mpeg \
  icecast://source:YOUR_PASSWORD@127.0.0.1:8000/pnptv
```

3. **Test stream:**
```bash
curl -I https://pnptv.app/radio/stream
```

---

## 📞 Need Help?

For production deployment assistance, consider:
1. Start with Icecast + Liquidsoap (free, flexible)
2. Try Azuracast if you want a web UI
3. Use a managed service for easiest setup

Current stream URL in radio.html:
```
https://pnptv.app/radio/stream
```

This URL needs to point to your Icecast/streaming server once configured.
