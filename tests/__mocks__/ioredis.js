// Mock for ioredis
class RedisMock {
  constructor() {
    this.data = new Map();
    this.listeners = new Map();
  }

  on(event, callback) {
    this.listeners.set(event, callback);
    if (event === 'connect' || event === 'ready') {
      setTimeout(() => callback(), 10);
    }
    return this;
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async set(key, value, ...args) {
    this.data.set(key, value);
    return 'OK';
  }

  async del(...keys) {
    keys.forEach(key => this.data.delete(key));
    return keys.length;
  }

  async keys(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }

  async exists(key) {
    return this.data.has(key) ? 1 : 0;
  }

  async incr(key) {
    const current = parseInt(this.data.get(key) || '0', 10);
    const newValue = current + 1;
    this.data.set(key, newValue.toString());
    return newValue;
  }

  async expire(key, seconds) {
    return 1;
  }

  async quit() {
    this.data.clear();
    return 'OK';
  }

  // Helper method for tests
  __clear() {
    this.data.clear();
  }
}

module.exports = RedisMock;
