# PNPtv Hangouts Web App

Video conferencing app powered by Agora RTC.

## Features

- ✅ HD video calls with multiple participants
- ✅ Audio/video controls (mute/unmute)
- ✅ Screen sharing
- ✅ Responsive grid layout
- ✅ Participant list
- ✅ Settings panel

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

Deploy the `dist` folder to your hosting service (Netlify, Vercel, etc.)

Configure the deployment:
- Base URL: `/hangouts/`
- Build command: `npm run build`
- Publish directory: `dist`

## Environment

The app receives parameters via URL query string:
- `room`: Channel name
- `token`: Agora RTC token
- `uid`: User ID
- `username`: Display name
- `type`: Call type (main/private)
- `appId`: Agora App ID (default: b68ab7b61ea44eabab7f242171311c5e)
