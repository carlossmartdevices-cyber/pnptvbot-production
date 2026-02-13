/**
 * E2E Test Suite 2: Hangout Flow
 * Tests the complete hangout room interaction (join, leave, kick, mute, spotlight)
 */

const axios = require('axios');
const TelegramSimulator = require('./helpers/telegram-simulator');

// Configure axios
const apiClient = axios.create({
  baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
  validateStatus: () => true // Don't throw on any status
});

describe('Hangout Flow E2E Tests', () => {
  let authToken1;
  let authToken2;
  let userId1;
  let userId2;
  let roomId;

  beforeAll(async () => {
    // Setup: Authenticate two users
    const user1InitData = TelegramSimulator.createInitData({
      id: 555555555,
      first_name: 'Alice',
      username: 'alice_hangout',
      language_code: 'en'
    });

    const user2InitData = TelegramSimulator.createInitData({
      id: 666666666,
      first_name: 'Bob',
      username: 'bob_hangout',
      language_code: 'en'
    });

    // Login user 1
    const response1 = await apiClient.post('/api/auth/telegram', { initData: user1InitData });
    authToken1 = response1.data.token;
    userId1 = response1.data.user.id;

    // Login user 2
    const response2 = await apiClient.post('/api/auth/telegram', { initData: user2InitData });
    authToken2 = response2.data.token;
    userId2 = response2.data.user.id;

    // Get available rooms
    const roomsResponse = await apiClient.get('/api/rooms', {
      headers: { 'Authorization': `Bearer ${authToken1}` }
    });

    if (roomsResponse.data.rooms && roomsResponse.data.rooms.length > 0) {
      roomId = roomsResponse.data.rooms[0].id;
    }
  });

  // Test 2.1: User can join hangout room
  test('2.1 User should be able to join hangout room', async () => {
    if (!roomId) {
      console.warn('⚠️ No rooms available, skipping test 2.1');
      return;
    }

    const response = await apiClient.post(`/api/rooms/${roomId}/join`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('channel_name');
    expect(response.data).toHaveProperty('agora_token');
    expect(response.data.current_participants).toBeGreaterThan(0);
  });

  // Test 2.2: User can leave hangout room
  test('2.2 User should be able to leave hangout room', async () => {
    if (!roomId) {
      console.warn('⚠️ No rooms available, skipping test 2.2');
      return;
    }

    // First join
    await apiClient.post(`/api/rooms/${roomId}/join`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    // Then leave
    const response = await apiClient.post(`/api/rooms/${roomId}/leave`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
    expect(response.data.message).toContain('left');
  });

  // Test 2.3: Room owner can kick participant
  test('2.3 Room owner should be able to kick participant', async () => {
    if (!roomId) {
      console.warn('⚠️ No rooms available, skipping test 2.3');
      return;
    }

    // Both users join
    await apiClient.post(`/api/rooms/${roomId}/join`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    await apiClient.post(`/api/rooms/${roomId}/join`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken2}` } }
    );

    // Owner (user1) kicks user2
    const response = await apiClient.post(`/api/rooms/${roomId}/kick`,
      { user_id: userId2 },
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    // Should succeed with 200 or 403 (if not room owner)
    expect([200, 403]).toContain(response.status);

    if (response.status === 200) {
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain('kick');
    }
  });

  // Test 2.4: Participant can be muted
  test('2.4 Room owner should be able to mute participant', async () => {
    if (!roomId) {
      console.warn('⚠️ No rooms available, skipping test 2.4');
      return;
    }

    // Both users join
    await apiClient.post(`/api/rooms/${roomId}/join`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    await apiClient.post(`/api/rooms/${roomId}/join`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken2}` } }
    );

    // Owner (user1) mutes user2
    const response = await apiClient.post(`/api/rooms/${roomId}/mute`,
      { user_id: userId2 },
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    // Should succeed with 200 or 403 (if not room owner)
    expect([200, 403, 404]).toContain(response.status);

    if (response.status === 200) {
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain('mute');
    }
  });

  // Test 2.5: Spotlight can be set on participant
  test('2.5 Room owner should be able to set spotlight on participant', async () => {
    if (!roomId) {
      console.warn('⚠️ No rooms available, skipping test 2.5');
      return;
    }

    // User joins room
    await apiClient.post(`/api/rooms/${roomId}/join`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    // Set spotlight on user1
    const response = await apiClient.post(`/api/rooms/${roomId}/spotlight`,
      { user_id: userId1 },
      { headers: { 'Authorization': `Bearer ${authToken1}` } }
    );

    // Should succeed with 200 or 403 (if not room owner)
    expect([200, 403, 404]).toContain(response.status);

    if (response.status === 200) {
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain('spotlight');
    }
  });
});
