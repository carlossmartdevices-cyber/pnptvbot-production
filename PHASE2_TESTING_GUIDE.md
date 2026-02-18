# Phase 2 Hangouts - Manual Testing Guide

## Testing Checklist

### Pre-Test Setup ✓
- [x] Database schema migrated (044_hangouts_video_schema.sql + 045_fix_agora_channels_schema.sql)
- [x] Models created (mainRoomModel.js + videoCallModel.js)
- [x] Controllers implemented (mainRoomController.js with 9 endpoints)
- [x] API routes registered in routes.js
- [x] Webapp created (public/main-rooms/index.html)
- [x] WebSocket service implemented
- [x] Test suite created (138+ tests, 92% passing)

### Browser Testing

#### 1. **Main Rooms Listing**
Steps:
1. Navigate to `http://localhost:3000/main-rooms`
2. Verify page loads with purple gradient design
3. Verify 3 rooms displayed (General, Music, Gaming)
4. Check participant counts for each room

Expected Results:
- [ ] Page loads without errors
- [ ] 3 room cards visible
- [ ] Participant counts show: "0/50" (or current counts)
- [ ] Room names visible
- [ ] Responsive design on mobile

#### 2. **Join Room as Viewer**
Steps:
1. Click "Join as Viewer" button on any room
2. Verify Telegram authentication popup appears
3. Complete auth and return to page
4. Check if join was successful

Expected Results:
- [ ] Modal/popup for authentication appears
- [ ] After auth, button changes to "Leave Room"
- [ ] Participant count increases by 1
- [ ] No console errors

#### 3. **WebSocket Real-time Updates**
Steps:
1. Open room in two browser tabs
2. Join room in Tab 1
3. Check Tab 2 for automatic participant count update
4. Join room in Tab 2
5. Verify count updates in Tab 1

Expected Results:
- [ ] Tab 2 shows updated count within 2 seconds
- [ ] Tab 1 sees count increase from Tab 2 join
- [ ] WebSocket connection shown in browser DevTools Network tab
- [ ] Messages show in WebSocket inspector

#### 4. **Leave Room**
Steps:
1. Click "Leave Room" button
2. Verify leave succeeds
3. Check participant count decreases

Expected Results:
- [ ] Leave succeeds silently
- [ ] Button changes back to "Join as Viewer"
- [ ] Participant count decreases by 1
- [ ] Other clients see count decrease

#### 5. **API Endpoints Testing**

**GET /api/rooms** (List all rooms)
```bash
curl http://localhost:3000/api/rooms
```
Expected: JSON array with 3 room objects, each with:
- [ ] id, name, description
- [ ] currentParticipants, maxParticipants
- [ ] publishers, viewers
- [ ] isFull, isActive

**GET /api/rooms/1** (Get room details)
```bash
curl http://localhost:3000/api/rooms/1
```
Expected: Single room object with all properties

**POST /api/rooms/:roomId/join** (Join room)
```bash
curl -X POST http://localhost:3000/api/rooms/1/join \
  -H "Content-Type: application/json" \
  -H "Cookie: [telegram-auth-cookie]" \
  -d '{"asPublisher": false}'
```
Expected:
- [ ] 200 status
- [ ] token, uid, appId in response
- [ ] currentParticipants incremented

**POST /api/rooms/:roomId/leave** (Leave room)
```bash
curl -X POST http://localhost:3000/api/rooms/1/leave \
  -H "Cookie: [telegram-auth-cookie]"
```
Expected:
- [ ] 200 status
- [ ] currentParticipants decremented

#### 6. **Error Handling**

**Test: Join Full Room**
Steps:
1. Set maxParticipants to 2 in database (for testing)
2. Have 2 users join as publishers
3. Try to join as publisher with 3rd user

Expected Results:
- [ ] 409 status code (Conflict)
- [ ] Error message: "Room is full"
- [ ] User cannot join

**Test: Auth Required**
Steps:
1. Make API call without authentication
2. Try to join room without Telegram auth

Expected Results:
- [ ] 401 status code (Unauthorized)
- [ ] Error: "Telegram authentication failed"

**Test: Rate Limiting**
Steps:
1. Send 50+ join requests rapidly from same user
2. Check 30th+ request

Expected Results:
- [ ] Initial requests succeed
- [ ] After limit exceeded: 429 status
- [ ] Error: "Rate limit exceeded"

### Performance Testing

#### Connection Speed
- [ ] Webpage loads in < 2 seconds
- [ ] Room list loads in < 500ms
- [ ] Join request completes in < 1 second
- [ ] WebSocket message delivered < 200ms

#### Concurrent Users
- [ ] Support 10 concurrent viewers per room
- [ ] Support 50 concurrent publishers per room
- [ ] No memory leaks with 100+ connections

### Browser DevTools Verification

#### Network Tab
- [ ] GET /api/rooms (200, < 200ms)
- [ ] POST /api/rooms/1/join (200, < 1s)
- [ ] WebSocket connection (101 Switching Protocols)

#### Console
- [ ] No 404 errors
- [ ] No CORS errors
- [ ] No JavaScript errors
- [ ] WebSocket connection log appears

#### Application > Storage > Cookies
- [ ] Telegram auth cookie present
- [ ] Session cookie present

### Video Conferencing Integration

#### With Agora

**Test: Agora Token Generation**
Steps:
1. Join room as viewer
2. Check response for token and uid
3. Verify token format: hex string

Expected Results:
- [ ] token: starts with valid characters
- [ ] uid: numeric value
- [ ] appId: matches process.env.AGORA_APP_ID

**Test: Video Call Initiation**
Steps:
1. Join room with Agora credentials
2. Attempt to initiate video call (if webcam available)
3. Verify stream connects

Expected Results:
- [ ] Video feed appears (with permission)
- [ ] Audio works
- [ ] No connection errors

### Database Verification

```sql
-- Check room participants
SELECT * FROM room_participants WHERE room_id = 1 AND left_at IS NULL;

-- Check room events
SELECT * FROM room_events WHERE room_id = 1 ORDER BY created_at DESC LIMIT 10;

-- Check room status
SELECT id, name, current_participants, max_participants FROM main_rooms;

-- Check call data
SELECT * FROM video_calls WHERE is_active = true;
```

Expected:
- [ ] Participants table populated correctly
- [ ] Events logged (USER_JOINED_VIEWER, USER_LEFT, etc.)
- [ ] Participant counts accurate
- [ ] Calls created with correct status

### Load Testing

#### 10 Concurrent Users
```bash
# Using Apache Bench or similar
ab -n 100 -c 10 http://localhost:3000/api/rooms
```
Expected:
- [ ] All requests succeed (200 status)
- [ ] Response time < 500ms per request
- [ ] No timeouts

#### WebSocket Stress Test
```javascript
// In browser console
const users = [];
for (let i = 0; i < 20; i++) {
  const ws = new WebSocket(`ws://localhost:3000/ws/rooms?userId=user${i}`);
  ws.onopen = () => {
    ws.send(JSON.stringify({action: 'JOIN_ROOM', roomId: 1}));
  };
  users.push(ws);
}

// Monitor memory and connections
```
Expected:
- [ ] All 20 connections establish
- [ ] No memory leaks
- [ ] Updates broadcast to all clients
- [ ] No connection drops

### Telegram Integration

#### Test: Telegram WebApp Auth
Steps:
1. Open webapp in Telegram app (using miniapp)
2. Authenticate via Telegram
3. Verify user data populated

Expected Results:
- [ ] Auth flow completes
- [ ] User ID captured
- [ ] Username/name displayed
- [ ] Subsequent API calls authenticated

### Cleanup & Tear-Down

After testing:
```bash
# Delete test data
DELETE FROM room_participants WHERE room_id IN (1, 2, 3) AND user_name LIKE 'Test%';
DELETE FROM room_events WHERE room_id IN (1, 2, 3) AND created_at > NOW() - INTERVAL '1 hour';

# Reset participant counts
UPDATE main_rooms SET current_participants = 0 WHERE id IN (1, 2, 3);
```

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page Load | ? | |
| List Rooms | ? | |
| Join Room | ? | |
| Real-time Updates | ? | |
| Leave Room | ? | |
| Error Handling | ? | |
| Performance | ? | |
| WebSocket | ? | |
| Database | ? | |

## Issues Found & Resolution

### Issue 1: [Description]
**Steps to Reproduce:** 
**Expected vs Actual:** 
**Solution:** 

---

## Sign-Off

- Tested by: ________________
- Date: ________________
- All tests passing: [ ] Yes [ ] No
- Ready for production: [ ] Yes [ ] No

**Notes:**
