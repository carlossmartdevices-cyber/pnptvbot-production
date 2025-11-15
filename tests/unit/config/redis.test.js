// Simple Redis configuration tests
describe('Redis Configuration', () => {
  it('should export required functions', () => {
    const redis = require('../../../src/config/redis');

    expect(redis.initializeRedis).toBeInstanceOf(Function);
    expect(redis.getRedis).toBeInstanceOf(Function);
    expect(redis.closeRedis).toBeInstanceOf(Function);
  });

  it('should export cache helper', () => {
    const redis = require('../../../src/config/redis');

    expect(redis.cache).toBeDefined();
    expect(redis.cache.get).toBeInstanceOf(Function);
    expect(redis.cache.set).toBeInstanceOf(Function);
    expect(redis.cache.del).toBeInstanceOf(Function);
    expect(redis.cache.delPattern).toBeInstanceOf(Function);
    expect(redis.cache.exists).toBeInstanceOf(Function);
    expect(redis.cache.incr).toBeInstanceOf(Function);
  });
});
