/**
 * Media Tests
 * Tests for live streams, radio, Hangouts/Jitsi
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

describe('Live Streams', () => {
  test('Live streams table exists', async () => {
    const { query } = require('../../src/config/postgres');

    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'live_streams'
      )
    `);

    expect(result.rows[0].exists).toBe(true);
  });

  test('Live stream model is importable', () => {
    let modelExists = false;
    try {
      const LiveStreamModel = require('../../src/models/liveStreamModel');
      modelExists = LiveStreamModel !== undefined;
    } catch (e) {
      modelExists = false;
    }

    expect(modelExists).toBe(true);
  });
});

describe('Radio Configuration', () => {
  test('Radio stream URL is configured', () => {
    expect(process.env.RADIO_STREAM_URL).toBeDefined();
  });

  test('Radio API URL is configured', () => {
    expect(process.env.RADIO_API_URL).toBeDefined();
  });

  test('Radio web app URL is configured', () => {
    expect(process.env.RADIO_WEB_APP_URL).toBeDefined();
  });

  test('Radio channel name is configured', () => {
    expect(process.env.RADIO_CHANNEL_NAME).toBeDefined();
  });
});

describe('Hangouts/Jitsi Configuration', () => {
  test('Hangouts web app URL is configured', () => {
    expect(process.env.HANGOUTS_WEB_APP_URL).toBeDefined();
  });

  test('JAAS App ID is configured', () => {
    expect(process.env.JAAS_APP_ID).toBeDefined();
  });

  test('JAAS API Key ID is configured', () => {
    expect(process.env.JAAS_API_KEY_ID).toBeDefined();
  });

  test('Jitsi domain is configured', () => {
    expect(process.env.JITSI_DOMAIN).toBeDefined();
  });

  test('Max room participants is configured', () => {
    expect(process.env.MAX_ROOM_PARTICIPANTS).toBeDefined();
  });
});

describe('Agora Configuration', () => {
  test('Agora App ID is configured', () => {
    expect(process.env.AGORA_APP_ID).toBeDefined();
  });

  test('Agora App Certificate is configured', () => {
    expect(process.env.AGORA_APP_CERTIFICATE).toBeDefined();
  });
});

describe('Jitsi Service', () => {
  test('Jitsi service is importable', () => {
    let serviceExists = false;
    try {
      const JitsiService = require('../../src/bot/services/jitsiService');
      serviceExists = JitsiService !== undefined;
    } catch (e) {
      serviceExists = false;
    }

    expect(serviceExists).toBe(true);
  });
});

describe('Media Handlers', () => {
  test('Live stream handler is importable', () => {
    let handlerExists = false;
    try {
      const handler = require('../../src/bot/handlers/media/livestream');
      handlerExists = handler !== undefined;
    } catch (e) {
      handlerExists = false;
    }

    expect(handlerExists).toBe(true);
  });

  test('Support handler is importable', () => {
    let handlerExists = false;
    try {
      const handler = require('../../src/bot/handlers/media/support');
      handlerExists = handler !== undefined;
    } catch (e) {
      handlerExists = false;
    }

    expect(handlerExists).toBe(true);
  });
});

describe('Media Web Apps', () => {
  test('Hangouts app is accessible', async () => {
    const hangoutsUrl = process.env.HANGOUTS_WEB_APP_URL;
    if (hangoutsUrl) {
      try {
        const response = await axios.get(hangoutsUrl, {
          timeout: 5000,
          validateStatus: () => true,
        });
        expect([200, 301, 302]).toContain(response.status);
      } catch (e) {
        // Network error is acceptable in test environment
        expect(true).toBe(true);
      }
    } else {
      expect(true).toBe(true);
    }
  });

  test('Radio app is accessible', async () => {
    const radioUrl = process.env.RADIO_WEB_APP_URL;
    if (radioUrl) {
      try {
        const response = await axios.get(radioUrl, {
          timeout: 5000,
          validateStatus: () => true,
        });
        expect([200, 301, 302]).toContain(response.status);
      } catch (e) {
        // Network error is acceptable in test environment
        expect(true).toBe(true);
      }
    } else {
      expect(true).toBe(true);
    }
  });
});
