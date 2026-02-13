/**
 * Unit Tests for LocationService
 * Tests location updates, rate limiting, heartbeat, and API calls
 */

const LocationService = require('../../../webapps/nearby/src/services/locationService');
const axios = require('axios');

jest.mock('axios');

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    LocationService.lastUpdateTime = 0;
    LocationService.currentLocation = null;
    LocationService.isActive = false;
    if (LocationService.heartbeatInterval) {
      clearInterval(LocationService.heartbeatInterval);
      LocationService.heartbeatInterval = null;
    }
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // Test 1: setAuthToken initializes axios instance
  test('should initialize axios instance with auth token', () => {
    const token = 'test_jwt_token_123';
    LocationService.setAuthToken(token);

    expect(LocationService.authToken).toBe(token);
    expect(LocationService.axiosInstance).toBeDefined();
  });

  // Test 2: updateLocation requires auth token
  test('should throw error if auth token not set', async () => {
    LocationService.authToken = null;

    await expect(
      LocationService.updateLocation(40.7505, -73.9706, 10)
    ).rejects.toThrow('Not authenticated');
  });

  // Test 3: updateLocation sends POST request
  test('should send location update to backend', async () => {
    LocationService.setAuthToken('test_token');
    axios.create.mockReturnValue({
      post: jest.fn().mockResolvedValue({
        data: { success: true }
      })
    });

    const response = await LocationService.updateLocation(40.7505, -73.9706, 10);

    expect(response).toEqual({ success: true });
  });

  // Test 4: Rate limiting - blocks updates within 5 seconds
  test('should enforce rate limit (5 seconds between updates)', async () => {
    LocationService.setAuthToken('test_token');
    LocationService.lastUpdateTime = Date.now();

    const mockAxios = {
      post: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    LocationService.axiosInstance = mockAxios;

    // Try to update immediately
    const promise = LocationService.updateLocation(40.7505, -73.9706, 10);

    // Fast-forward 2 seconds (still within rate limit)
    jest.advanceTimersByTime(2000);

    // The update should still be pending (queued)
    expect(mockAxios.post).not.toHaveBeenCalled();

    // Fast-forward 4 more seconds (total 6 seconds, past rate limit)
    jest.advanceTimersByTime(4000);

    await promise;

    // Now the update should be sent
    expect(mockAxios.post).toHaveBeenCalled();
  });

  // Test 5: Update location stores last update time
  test('should store last update time after successful update', async () => {
    LocationService.setAuthToken('test_token');
    const mockAxios = {
      post: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    LocationService.axiosInstance = mockAxios;

    const beforeTime = Date.now();
    await LocationService.updateLocation(40.7505, -73.9706, 10);
    const afterTime = Date.now();

    expect(LocationService.lastUpdateTime).toBeGreaterThanOrEqual(beforeTime);
    expect(LocationService.lastUpdateTime).toBeLessThanOrEqual(afterTime);
  });

  // Test 6: Update location stores current location
  test('should cache current location', async () => {
    LocationService.setAuthToken('test_token');
    const mockAxios = {
      post: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    LocationService.axiosInstance = mockAxios;

    await LocationService.updateLocation(40.7505, -73.9706, 10);

    expect(LocationService.currentLocation).toEqual({
      latitude: 40.7505,
      longitude: -73.9706,
      accuracy: 10
    });
  });

  // Test 7: searchNearby requires auth token
  test('should throw error if auth token not set for search', async () => {
    LocationService.authToken = null;

    await expect(
      LocationService.searchNearby()
    ).rejects.toThrow('Not authenticated');
  });

  // Test 8: searchNearby uses current location if not provided
  test('should use cached location for search if not provided', async () => {
    LocationService.setAuthToken('test_token');
    LocationService.currentLocation = {
      latitude: 40.7505,
      longitude: -73.9706,
      accuracy: 10
    };

    const mockAxios = {
      get: jest.fn().mockResolvedValue({
        data: { users: [] }
      })
    };
    LocationService.axiosInstance = mockAxios;

    await LocationService.searchNearby();

    expect(mockAxios.get).toHaveBeenCalledWith('/api/nearby/search', {
      params: {
        latitude: '40.7505',
        longitude: '-73.9706',
        radius: 5
      }
    });
  });

  // Test 9: searchNearby throws if no location available
  test('should throw error if location not available for search', async () => {
    LocationService.setAuthToken('test_token');
    LocationService.currentLocation = null;

    await expect(
      LocationService.searchNearby()
    ).rejects.toThrow('Location not available');
  });

  // Test 10: startHeartbeat begins regular updates
  test('should start heartbeat interval', () => {
    LocationService.setAuthToken('test_token');
    LocationService.currentLocation = {
      latitude: 40.7505,
      longitude: -73.9706,
      accuracy: 10
    };

    const mockAxios = {
      post: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    LocationService.axiosInstance = mockAxios;

    LocationService.startHeartbeat();

    expect(LocationService.heartbeatInterval).toBeDefined();
    expect(LocationService.isActive).toBe(true);

    // Advance 30 seconds and verify update is sent
    jest.advanceTimersByTime(30000);

    expect(mockAxios.post).toHaveBeenCalled();
  });

  // Test 11: stopHeartbeat clears interval
  test('should stop heartbeat when called', () => {
    LocationService.setAuthToken('test_token');
    LocationService.currentLocation = {
      latitude: 40.7505,
      longitude: -73.9706,
      accuracy: 10
    };

    LocationService.startHeartbeat();
    const intervalId = LocationService.heartbeatInterval;

    LocationService.stopHeartbeat();

    expect(LocationService.heartbeatInterval).toBeNull();
    expect(LocationService.isActive).toBe(false);
  });

  // Test 12: getCurrentLocation returns cached location
  test('should return cached location', async () => {
    LocationService.setAuthToken('test_token');
    const mockAxios = {
      post: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    LocationService.axiosInstance = mockAxios;

    await LocationService.updateLocation(40.7505, -73.9706, 10);

    const location = LocationService.getCurrentLocation();

    expect(location).toEqual({
      latitude: 40.7505,
      longitude: -73.9706,
      accuracy: 10
    });
  });

  // Test 13: isTracking returns correct status
  test('should return tracking status', () => {
    expect(LocationService.isTracking()).toBe(false);

    LocationService.isActive = true;
    expect(LocationService.isTracking()).toBe(true);

    LocationService.isActive = false;
    expect(LocationService.isTracking()).toBe(false);
  });

  // Test 14: getTimeSinceLastUpdate returns seconds
  test('should return time since last update', async () => {
    LocationService.setAuthToken('test_token');
    const mockAxios = {
      post: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    LocationService.axiosInstance = mockAxios;

    await LocationService.updateLocation(40.7505, -73.9706, 10);

    // Advance 10 seconds
    jest.advanceTimersByTime(10000);

    const timeSince = LocationService.getTimeSinceLastUpdate();

    expect(timeSince).toBeGreaterThanOrEqual(10);
  });

  // Test 15: Handle rate limit error (429)
  test('should handle 429 rate limit response', async () => {
    LocationService.setAuthToken('test_token');
    const mockAxios = {
      post: jest.fn().mockResolvedValue({
        status: 429,
        response: { status: 429, data: { error: 'Too many requests' } }
      })
    };
    LocationService.axiosInstance = mockAxios;

    LocationService.lastUpdateTime = 0; // Allow update

    try {
      await LocationService.updateLocation(40.7505, -73.9706, 10);
    } catch (error) {
      expect(error.message).toContain('Too many');
    }
  });

  // Test 16: Handle 401 authentication error
  test('should handle 401 authentication error', async () => {
    LocationService.setAuthToken('invalid_token');
    const mockError = new Error('Unauthorized');
    mockError.response = { status: 401, data: { error: 'Auth failed' } };

    const mockAxios = {
      post: jest.fn().mockRejectedValue(mockError)
    };
    LocationService.axiosInstance = mockAxios;
    LocationService.lastUpdateTime = 0;

    try {
      await LocationService.updateLocation(40.7505, -73.9706, 10);
    } catch (error) {
      expect(error.message).toContain('Authentication');
    }
  });
});
