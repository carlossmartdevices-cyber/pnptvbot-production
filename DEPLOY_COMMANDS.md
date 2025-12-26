# Deployment Commands for PNPtv Bot

## SSH to Server
```bash
ssh root@72.60.29.80
```

## Once on the server, run these commands:

```bash
# Navigate to the project directory
cd /root/pnptvbot-production

# Pull latest changes from main branch
git fetch origin main
git checkout main
git pull origin main

# Install any new dependencies (if needed)
npm install

# Restart the bot using PM2
pm2 restart pnptv-bot

# Or if not running yet, start it
pm2 start ecosystem.config.js

# Check the status
pm2 status

# View logs to verify it's working
pm2 logs pnptv-bot --lines 50

# Save PM2 process list (to persist across reboots)
pm2 save
```

## What's being deployed:

✅ Video call button now connects to community rooms
✅ Button text updated to "Salas de Video Llamadas" / "Video Call Rooms"
✅ Jitsi configured with:
   - No prejoin page
   - Audio unmuted on join (current main branch)
   - Video unmuted on join
   - User display name automatically set

Note: The audio muted setting change is in the local branch but not yet on origin/main due to branch protection.
