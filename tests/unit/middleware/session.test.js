// Mock dependencies
jest.mock('../../../src/config/redis');

const sessionMiddleware = require('../../../src/bot/core/middleware/session');
const { cache } = require('../../../src/config/redis');

describe('Session Middleware', () => {
  let mockCtx;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNext = jest.fn().mockResolvedValue();
    mockCtx = {
      from: {
        id: 123456789,
        language_code: 'en',
      },
    };

    cache.get = jest.fn().mockResolvedValue(null);
    cache.set = jest.fn().mockResolvedValue(true);
    cache.del = jest.fn().mockResolvedValue(true);
  });

  it('should create new session for new user', async () => {
    const middleware = sessionMiddleware();

    await middleware(mockCtx, mockNext);

    expect(mockCtx.session).toBeDefined();
    expect(mockCtx.session.language).toBe('en');
    expect(mockCtx.session.userId).toBe(123456789);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should load existing session from cache', async () => {
    const existingSession = {
      language: 'es',
      userId: 123456789,
      temp: { data: 'test' },
    };

    cache.get.mockResolvedValue(existingSession);

    const middleware = sessionMiddleware();
    await middleware(mockCtx, mockNext);

    expect(mockCtx.session).toEqual(existingSession);
  });

  it('should save session after processing', async () => {
    const middleware = sessionMiddleware();

    await middleware(mockCtx, mockNext);

    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('session:'),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should provide saveSession method', async () => {
    const middleware = sessionMiddleware();

    await middleware(mockCtx, mockNext);

    expect(mockCtx.saveSession).toBeInstanceOf(Function);

    await mockCtx.saveSession();

    expect(cache.set).toHaveBeenCalled();
  });

  it('should provide clearSession method', async () => {
    const middleware = sessionMiddleware();

    await middleware(mockCtx, mockNext);

    expect(mockCtx.clearSession).toBeInstanceOf(Function);

    await mockCtx.clearSession();

    expect(cache.del).toHaveBeenCalled();
    expect(mockCtx.session).toBeDefined();
    expect(mockCtx.session.temp).toEqual({});
  });

  it('should fallback to in-memory storage on Redis error', async () => {
    cache.get.mockRejectedValue(new Error('Redis error'));
    cache.set.mockRejectedValue(new Error('Redis error'));

    const middleware = sessionMiddleware();

    await expect(middleware(mockCtx, mockNext)).resolves.not.toThrow();
    expect(mockCtx.session).toBeDefined();
  });

  it('should call next even if session fails', async () => {
    const middleware = sessionMiddleware();
    mockCtx.from = null; // Cause an error

    await middleware(mockCtx, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
