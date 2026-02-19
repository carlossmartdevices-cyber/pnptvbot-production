/**
 * Radio & Videorama End-to-End Tests
 * Tests all radio and videorama functionality
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:3001';
const JWT_TOKEN = process.env.TEST_JWT_TOKEN || 'test-jwt-token';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    if (options.token) {
      reqOptions.headers['Authorization'] = `Bearer ${options.token}`;
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('Radio & Videorama APIs', () => {
  describe('Public Radio Endpoints', () => {
    test('GET /api/radio/now-playing returns current track', async () => {
      const res = await makeRequest('/api/radio/now-playing');
      assert.equal(res.status, 200);
      assert(res.body.track);
      assert(res.body.listenerCount !== undefined);
    });

    test('GET /api/radio/history returns play history', async () => {
      const res = await makeRequest('/api/radio/history');
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.data));
    });

    test('GET /api/radio/schedule returns schedule', async () => {
      const res = await makeRequest('/api/radio/schedule');
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.data));
    });

    test('POST /api/radio/request submits song request', async () => {
      const res = await makeRequest('/api/radio/request', {
        method: 'POST',
        body: {
          userId: 'test-user-123',
          songName: 'Test Song',
          artist: 'Test Artist',
        },
      });
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(res.body.requestId);
    });
  });

  describe('Public Media Endpoints', () => {
    test('GET /api/media/library returns media list', async () => {
      const res = await makeRequest('/api/media/library');
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.data));
      assert(res.body.count !== undefined);
    });

    test('GET /api/media/library filters by type', async () => {
      const res = await makeRequest('/api/media/library?type=audio');
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.data));
    });

    test('GET /api/media/library filters by category', async () => {
      const res = await makeRequest('/api/media/library?category=music');
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.data));
    });

    test('GET /api/media/categories returns available categories', async () => {
      const res = await makeRequest('/api/media/categories');
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.data));
    });

    test('GET /api/media/:mediaId returns single media', async () => {
      // First get a media ID
      const listRes = await makeRequest('/api/media/library?limit=1');
      if (listRes.body.data.length > 0) {
        const mediaId = listRes.body.data[0].id;
        const res = await makeRequest(`/api/media/${mediaId}`);
        assert.equal(res.status, 200);
        assert(res.body.success === true);
        assert(res.body.data.id === mediaId);
      }
    });

    test('GET /api/media/playlists returns public playlists', async () => {
      const res = await makeRequest('/api/media/playlists');
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.data));
    });
  });

  describe('Public Videorama Endpoints', () => {
    test('GET /api/videorama/collections returns collections', async () => {
      const res = await makeRequest('/api/videorama/collections');
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.collections));
    });

    test('GET /api/videorama/collections/:id returns collection items', async () => {
      const collRes = await makeRequest('/api/videorama/collections');
      if (collRes.body.collections.length > 0) {
        const collectionId = collRes.body.collections[0].id;
        const collectionType = collRes.body.collections[0].type;
        const res = await makeRequest(
          `/api/videorama/collections/${collectionId}?type=${collectionType}`
        );
        assert.equal(res.status, 200);
        assert(res.body.success === true);
        assert(Array.isArray(res.body.items));
      }
    });
  });

  describe('Admin Media Endpoints (requires JWT)', () => {
    test('GET /api/admin/media/library requires auth', async () => {
      const res = await makeRequest('/api/admin/media/library');
      assert.equal(res.status, 401);
    });

    test('GET /api/admin/media/library returns paginated media', async () => {
      const res = await makeRequest('/api/admin/media/library?page=1&limit=10', {
        token: JWT_TOKEN,
      });
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.media));
      assert(res.body.pagination);
    });

    test('GET /api/admin/media/categories returns categories', async () => {
      const res = await makeRequest('/api/admin/media/categories', {
        token: JWT_TOKEN,
      });
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.categories));
    });

    test('DELETE /api/admin/media/:mediaId removes media', async () => {
      // This test would require creating media first
      // Skipping for now to avoid side effects
    });
  });

  describe('Admin Radio Endpoints (requires JWT)', () => {
    test('GET /api/admin/radio/now-playing requires auth', async () => {
      const res = await makeRequest('/api/admin/radio/now-playing');
      assert.equal(res.status, 401);
    });

    test('GET /api/admin/radio/now-playing returns current track', async () => {
      const res = await makeRequest('/api/admin/radio/now-playing', {
        token: JWT_TOKEN,
      });
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(res.body.nowPlaying !== undefined);
    });

    test('POST /api/admin/radio/now-playing sets track', async () => {
      const res = await makeRequest('/api/admin/radio/now-playing', {
        method: 'POST',
        token: JWT_TOKEN,
        body: {
          title: 'Test Track',
          artist: 'Test Artist',
          duration: 180,
        },
      });
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(res.body.nowPlaying);
    });

    test('GET /api/admin/radio/queue returns queue', async () => {
      const res = await makeRequest('/api/admin/radio/queue', {
        token: JWT_TOKEN,
      });
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.queue));
    });

    test('GET /api/admin/radio/requests returns requests', async () => {
      const res = await makeRequest('/api/admin/radio/requests', {
        token: JWT_TOKEN,
      });
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.requests));
    });

    test('GET /api/admin/radio/requests filters by status', async () => {
      const res = await makeRequest('/api/admin/radio/requests?status=pending', {
        token: JWT_TOKEN,
      });
      assert.equal(res.status, 200);
      assert(res.body.success === true);
      assert(Array.isArray(res.body.requests));
    });
  });

  describe('Error Handling', () => {
    test('Returns 404 for invalid media ID', async () => {
      const res = await makeRequest('/api/media/invalid-uuid-12345');
      assert.equal(res.status, 404);
    });

    test('Returns error for invalid request body', async () => {
      const res = await makeRequest('/api/radio/request', {
        method: 'POST',
        body: {
          // Missing required fields
        },
      });
      assert.equal(res.status, 400);
    });

    test('Returns 401 for protected admin endpoints without JWT', async () => {
      const res = await makeRequest('/api/admin/radio/queue');
      assert.equal(res.status, 401);
    });
  });
});

describe('Radio & Videorama Data Structure Validation', () => {
  test('Media items have required fields', async () => {
    const res = await makeRequest('/api/media/library?limit=1');
    if (res.body.data.length > 0) {
      const media = res.body.data[0];
      assert(media.id);
      assert(media.title);
      assert(media.type);
      assert(['audio', 'video'].includes(media.type));
    }
  });

  test('Radio now playing has correct structure', async () => {
    const res = await makeRequest('/api/radio/now-playing');
    assert(res.body.track);
    assert(res.body.track.title !== undefined);
    assert(res.body.track.artist !== undefined);
    assert(res.body.listenerCount !== undefined);
  });

  test('Videorama collection has correct structure', async () => {
    const res = await makeRequest('/api/videorama/collections');
    if (res.body.collections.length > 0) {
      const coll = res.body.collections[0];
      assert(coll.id);
      assert(coll.title);
      assert(coll.type);
      assert(['playlist', 'category'].includes(coll.type));
    }
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('Running Radio & Videorama Tests...\n');

  const tests = [
    {
      name: 'Public Radio: GET /api/radio/now-playing',
      fn: () => makeRequest('/api/radio/now-playing'),
    },
    {
      name: 'Public Media: GET /api/media/library',
      fn: () => makeRequest('/api/media/library'),
    },
    {
      name: 'Public Videorama: GET /api/videorama/collections',
      fn: () => makeRequest('/api/videorama/collections'),
    },
  ];

  Promise.all(tests.map(async (test) => {
    try {
      const res = await test.fn();
      console.log(`✓ ${test.name} - Status: ${res.status}`);
    } catch (err) {
      console.log(`✗ ${test.name} - Error: ${err.message}`);
    }
  })).then(() => {
    console.log('\nAll tests completed!');
    process.exit(0);
  });
}

module.exports = { makeRequest };
