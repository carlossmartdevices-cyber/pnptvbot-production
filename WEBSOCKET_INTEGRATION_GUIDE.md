# WebSocket Real-time Room Updates - Integration Guide

## Overview

The WebSocket service enables real-time participant count updates and room status changes for the Hangouts feature.

**Features:**
- Live participant count updates
- Room status notifications (full, available)
- User join/leave events
- Connection management and cleanup
- Automatic fallback to polling if WebSocket unavailable

## Files Created

1. **`src/services/websocket/roomWebSocketService.js`** (178 lines)
   - Core WebSocket service with client management
   - Broadcast methods for real-time updates
   - Connection tracking and statistics

2. **`src/bot/websocket/roomWebSocketHandler.js`** (250 lines)
   - WebSocket server setup and connection handling
   - Message routing and processing
   - Integration with MainRoomController

## Installation

### 1. Install WebSocket Library (if not already installed)

```bash
npm install ws
```

### 2. Update Bot Server Setup

In `/root/pnptvbot-sandbox/src/bot/core/bot.js`, modify the `startApiServer()` function (around line 208):

**BEFORE:**
```javascript
const server = apiApp.listen(PORT, '0.0.0.0', () => {
  logger.info(`✓ ${prefix}API server running on port ${PORT}`);
});
```

**AFTER:**
```javascript
const http = require('http');
const { setupRoomWebSocketServer } = require('../websocket/roomWebSocketHandler');

// Create HTTP server
const server = http.createServer(apiApp);

// Setup WebSocket server
const wss = setupRoomWebSocketServer(server);

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`✓ ${prefix}API server running on port ${PORT}`);
  logger.info(`✓ WebSocket server running on ws://0.0.0.0:${PORT}/ws/rooms`);
});
```

### 3. Integrate with MainRoomController

In `/root/pnptvbot-sandbox/src/bot/api/controllers/mainRoomController.js`, add WebSocket notifications when users join/leave:

**In `joinRoom()` method, after successful join:**
```javascript
const { broadcastRoomUpdate } = require('../../websocket/roomWebSocketHandler');

// After MainRoomModel.joinRoom() succeeds...
const updatedRoom = await MainRoomModel.getById(room.id);
broadcastRoomUpdate(
  room.id,
  userName,
  updatedRoom.currentParticipants,
  updatedRoom.maxParticipants,
  'join'
);
```

**In `leaveRoom()` method, after successful leave:**
```javascript
// After MainRoomModel.leaveRoom() succeeds...
const updatedRoom = await MainRoomModel.getById(parseInt(roomId));
broadcastRoomUpdate(
  parseInt(roomId),
  auth.user.firstName || 'User',
  updatedRoom.currentParticipants,
  updatedRoom.maxParticipants,
  'leave'
);
```

## Client-Side Usage

### Connect to WebSocket

```javascript
const userId = '123456789';
const ws = new WebSocket(`ws://localhost:3000/ws/rooms?userId=${userId}`);

ws.addEventListener('open', () => {
  console.log('Connected to room updates');

  // Join specific room
  ws.send(JSON.stringify({
    action: 'JOIN_ROOM',
    roomId: 1,
    userId: userId
  }));
});

ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'ROOM_UPDATE') {
    console.log(`Room ${data.roomId} - ${data.currentParticipants}/${data.maxParticipants}`);
    // Update UI with new participant count
  }
});

ws.addEventListener('error', (error) => {
  console.error('WebSocket error:', error);
  // Fallback to polling
});

ws.addEventListener('close', () => {
  console.log('Disconnected from room updates');
  // Attempt reconnect
});
```

### Webapp Integration

The `/public/main-rooms/index.html` already has WebSocket support. It connects automatically when accessing a room.

**Upgrade the webapp to use WebSocket:**

In the webapp JavaScript section:
```javascript
const WEBSOCKET_URL = window.location.protocol === 'https:'
  ? `wss://${window.location.host}`
  : `ws://${window.location.host}`;

async function joinRoom(roomId, asPublisher) {
  // ... existing HTTP join logic ...

  // Setup WebSocket for real-time updates
  if (window.WebSocket) {
    const ws = new WebSocket(`${WEBSOCKET_URL}/ws/rooms?userId=${userId}`);
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.roomId === roomId) {
        updateRoomUI(data);
      }
    });
  }
}
```

## Message Protocol

### Client to Server

**Join Room:**
```json
{
  "action": "JOIN_ROOM",
  "roomId": 1,
  "userId": "123456789"
}
```

**Leave Room:**
```json
{
  "action": "LEAVE_ROOM",
  "roomId": 1,
  "userId": "123456789"
}
```

**Get Room Status:**
```json
{
  "action": "GET_ROOM_STATUS",
  "roomId": 1
}
```

**Ping (heartbeat):**
```json
{
  "action": "PING"
}
```

### Server to Client

**Connection Established:**
```json
{
  "type": "CONNECTION_ESTABLISHED",
  "userId": "123456789",
  "timestamp": "2026-02-12T23:45:00Z",
  "message": "Connected to room updates"
}
```

**Room Update:**
```json
{
  "type": "ROOM_UPDATE",
  "roomId": 1,
  "event": "USER_JOINED",
  "participantName": "John Doe",
  "currentParticipants": 25,
  "maxParticipants": 50,
  "isFull": false,
  "availableSlots": 25,
  "timestamp": "2026-02-12T23:45:00Z"
}
```

**Room Status:**
```json
{
  "type": "ROOM_STATUS",
  "roomId": 1,
  "connectedClients": 5,
  "timestamp": "2026-02-12T23:45:00Z"
}
```

**Pong (heartbeat response):**
```json
{
  "type": "PONG",
  "timestamp": "2026-02-12T23:45:00Z"
}
```

## Fallback (Polling)

If WebSocket is not available, the webapp will use polling:

```javascript
async function pollRoomUpdates(roomId, interval = 5000) {
  setInterval(async () => {
    const response = await fetch(`/api/rooms/${roomId}`);
    const room = await response.json();
    updateRoomUI(room);
  }, interval);
}
```

## Testing

### Test WebSocket Connection

```javascript
// In browser console
const ws = new WebSocket(`ws://${window.location.host}/ws/rooms?userId=123456789`);

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ action: 'PING' }));
};

ws.onmessage = (e) => {
  console.log('Message:', JSON.parse(e.data));
};
```

### Check Server Stats

```javascript
const service = require('./src/services/websocket/roomWebSocketService');
console.log(service.getStats());
// Output: { totalRoomsWithClients: 2, totalConnections: 5, totalUsersTracked: 3, activeRooms: [1, 2] }
```

## Performance Considerations

- **Max connections per room:** Unlimited (depends on server capacity)
- **Message rate:** ~1-10 messages per participant per minute (join/leave events)
- **Memory per connection:** ~1-2 KB
- **Memory for 1000 connections:** ~1-2 MB

## Production Deployment

For production deployment:

1. Use WSS (WebSocket over SSL/TLS) behind Nginx reverse proxy
2. Configure Nginx to proxy WebSocket connections:

```nginx
location /ws/ {
  proxy_pass http://localhost:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_read_timeout 86400;
}
```

3. Enable connection monitoring and auto-reconnect on client
4. Implement connection pooling for high-traffic rooms

## Troubleshooting

**WebSocket connection fails:**
- Check firewall rules (port 3000 or 443 for WSS)
- Verify Nginx proxy configuration
- Check browser console for errors

**No real-time updates:**
- Verify MainRoomController calls `broadcastRoomUpdate()`
- Check WebSocket server is running: `curl ws://localhost:3000/ws/rooms`
- Verify client joined room via `JOIN_ROOM` action

**High memory usage:**
- Monitor active rooms with `getStats()`
- Check for disconnected clients not being cleaned up
- Implement connection idle timeout

## Next Steps

1. Update `src/bot/core/bot.js` with HTTP server setup
2. Update `src/bot/api/controllers/mainRoomController.js` with broadcast calls
3. Test WebSocket connections in browser
4. Update webapp HTML to show real-time participant counts
5. Deploy to production with Nginx WSS configuration
