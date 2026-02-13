/**
 * k6 Load Testing Script
 * Tests Nearby Geolocation API endpoints
 * Run with: k6 run load-tests/k6-load-test.js
 *
 * Configuration:
 * K6_VUS=100 k6 run load-tests/k6-load-test.js
 * K6_DURATION=5m k6 run load-tests/k6-load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const updateLocationDuration = new Trend('location_update_duration');
const searchDuration = new Trend('location_search_duration');
const rateLimitErrors = new Counter('rate_limit_errors');
const successfulUpdates = new Counter('successful_updates');

// Configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },    // Warm up
    { duration: '5m', target: 50 },    // Sustained load
    { duration: '2m', target: 200 },   // Spike
    { duration: '1m', target: 10 },    // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    'http_req_failed': ['rate<0.1'],                    // Error rate < 10%
    'errors': ['rate<0.05'],                            // Custom error rate < 5%
  },
};

// Setup: Run once before test
export function setup() {
  console.log('🚀 Starting k6 load test...');

  return {
    apiUrl: __ENV.API_URL || 'http://localhost:3001',
    authToken: __ENV.AUTH_TOKEN || 'test_token_123',
    testUsers: [
      'user-load-001',
      'user-load-002',
      'user-load-003',
      'user-load-004',
      'user-load-005',
    ]
  };
}

// Teardown: Run once after test
export function teardown(data) {
  console.log('✅ Load test complete');
}

/**
 * Test 1: Location Update Load
 */
export function testLocationUpdate(data) {
  group('Location Update API', () => {
    const payload = JSON.stringify({
      latitude: 40.7128 + (Math.random() - 0.5) * 0.2,
      longitude: -74.0060 + (Math.random() - 0.5) * 0.2,
      accuracy: Math.floor(Math.random() * 100) + 5,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`,
      },
    };

    const res = http.post(
      `${data.apiUrl}/api/nearby/update-location`,
      payload,
      params
    );

    updateLocationDuration.add(res.timings.duration);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response is success': (r) => r.json('success') === true,
      'has user_id': (r) => r.json('user_id') !== undefined,
      'has timestamp': (r) => r.json('timestamp') !== undefined,
    });

    if (success) {
      successfulUpdates.add(1);
    } else {
      errorRate.add(1);
    }
  });

  sleep(1);
}

/**
 * Test 2: Nearby Users Search Load
 */
export function testNearbySearch(data) {
  group('Nearby Search API', () => {
    const params = {
      headers: {
        'Authorization': `Bearer ${data.authToken}`,
      },
    };

    const res = http.get(
      `${data.apiUrl}/api/nearby/search?latitude=40.7128&longitude=-74.0060&radius=5&limit=50`,
      params
    );

    searchDuration.add(res.timings.duration);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response is success': (r) => r.json('success') === true,
      'has users array': (r) => Array.isArray(r.json('users')),
      'has total field': (r) => r.json('total') !== undefined,
    });

    if (!success) {
      errorRate.add(1);
    }
  });

  sleep(2);
}

/**
 * Test 3: Rate Limiting Stress Test
 */
export function testRateLimiting(data) {
  group('Rate Limit Stress Test', () => {
    // Send 10 requests in quick succession (should hit rate limit)
    for (let i = 0; i < 10; i++) {
      const payload = JSON.stringify({
        latitude: 40.7128 + Math.random() * 0.1,
        longitude: -74.0060 + Math.random() * 0.1,
        accuracy: 25,
      });

      const params = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.authToken}`,
        },
      };

      const res = http.post(
        `${data.apiUrl}/api/nearby/update-location`,
        payload,
        params
      );

      // Check for rate limit response
      if (res.status === 429) {
        rateLimitErrors.add(1);

        check(res, {
          'rate limit status is 429': (r) => r.status === 429,
          'has retry_after': (r) => r.json('retry_after') !== undefined,
        });
      }
    }
  });

  sleep(6); // Wait for rate limit to reset
}

/**
 * Test 4: Error Handling
 */
export function testErrorHandling(data) {
  group('Error Handling', () => {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`,
      },
    };

    // Test 1: Invalid coordinates (latitude > 90)
    let res = http.post(
      `${data.apiUrl}/api/nearby/update-location`,
      JSON.stringify({
        latitude: 999,
        longitude: -74.0060,
        accuracy: 25,
      }),
      params
    );

    check(res, {
      'invalid latitude returns 400': (r) => r.status === 400,
    });

    // Test 2: Missing required field
    res = http.post(
      `${data.apiUrl}/api/nearby/update-location`,
      JSON.stringify({
        latitude: 40.7128,
        // Missing longitude and accuracy
      }),
      params
    );

    check(res, {
      'missing field returns 400': (r) => r.status === 400,
    });

    // Test 3: No authentication
    res = http.get(
      `${data.apiUrl}/api/nearby/search?latitude=40.7128&longitude=-74.0060`,
      { headers: { 'Authorization': '' } }
    );

    check(res, {
      'missing auth returns 401': (r) => r.status === 401,
    });
  });

  sleep(1);
}

/**
 * Test 5: Statistics API
 */
export function testStats(data) {
  group('Statistics API', () => {
    const params = {
      headers: {
        'Authorization': `Bearer ${data.authToken}`,
      },
    };

    const res = http.get(
      `${data.apiUrl}/api/nearby/stats`,
      params
    );

    check(res, {
      'status is 200': (r) => r.status === 200,
      'has online_users': (r) => r.json('online_users') !== undefined,
      'has total_tracked': (r) => r.json('total_tracked') !== undefined,
    });
  });

  sleep(5);
}

/**
 * Main Test Function
 */
export default function (data) {
  // Distribute tests across VUs
  const testChoice = Math.random();

  if (testChoice < 0.4) {
    testLocationUpdate(data);
  } else if (testChoice < 0.7) {
    testNearbySearch(data);
  } else if (testChoice < 0.85) {
    testRateLimiting(data);
  } else if (testChoice < 0.95) {
    testErrorHandling(data);
  } else {
    testStats(data);
  }
}

/**
 * Performance Summary Report
 *
 * Metrics collected:
 * - location_update_duration: Time to update location
 * - location_search_duration: Time to search nearby
 * - rate_limit_errors: Count of 429 responses
 * - errors: Total error rate
 * - http_req_duration: All HTTP request durations
 * - http_req_failed: Failed request rate
 *
 * Success criteria (thresholds):
 * - 95% of requests < 500ms
 * - 99% of requests < 1000ms
 * - Error rate < 10%
 * - Custom error rate < 5%
 */
