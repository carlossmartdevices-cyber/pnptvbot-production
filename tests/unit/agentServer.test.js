const request = require('supertest');
const AgentServer = require('../../src/agent/server');

jest.mock('redis', () => {
  class FakeRedis {
    constructor() {
      this.store = new Map();
      this.lists = new Map();
      this.closed = false;
    }
    async connect() { return; }
    on() { }
    async lPush(key, value) {
      const arr = this.lists.get(key) || [];
      arr.unshift(value);
      this.lists.set(key, arr);
      return arr.length;
    }
    async lRange(key, start, end) {
      const arr = this.lists.get(key) || [];
      // Support negative end like Redis (e.g., -1 means last element)
      const realEnd = end < 0 ? arr.length - 1 : end;
      return arr.slice(start, realEnd + 1);
    }
    async set(key, value) { this.store.set(key, value); return 'OK'; }
    async get(key) { return this.store.get(key) || null; }
    async quit() { this.closed = true; }
  }
  return { createClient: () => new FakeRedis() };
});

describe('AgentServer', () => {
  let agent;

  beforeAll(async () => {
    agent = new AgentServer();
  });

  afterAll(async () => {
    await agent.stop();
  });

  test('should enqueue a payment task', async () => {
    const res = await request(agent.app)
      .post('/process-payment')
      .send({ userId: 'u1', amount: 10, currency: 'USD', paymentMethod: 'card' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.taskId).toBeDefined();

    const items = await agent.redisClient.lRange('payment_tasks', 0, -1);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('should return task status', async () => {
    const taskId = 'status-test-1';
    await agent.redisClient.set(`task:${taskId}:status`, 'completed');

    const res = await request(agent.app).get(`/task-status/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});
