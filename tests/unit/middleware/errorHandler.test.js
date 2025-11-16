// Mock dependencies
jest.mock('@sentry/node');
jest.mock('../../../src/utils/i18n');

const errorHandler = require('../../../src/bot/core/middleware/errorHandler');
const Sentry = require('@sentry/node');
const { t } = require('../../../src/utils/i18n');

describe('Error Handler Middleware', () => {
  let mockCtx;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCtx = {
      from: {
        id: 123456789,
        username: 'testuser',
      },
      session: {
        language: 'en',
      },
      update: {},
      reply: jest.fn().mockResolvedValue({}),
    };

    t.mockReturnValue('An error occurred');
  });

  it('should log error and send to Sentry', async () => {
    const error = new Error('Test error');

    await errorHandler(error, mockCtx);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        user: expect.objectContaining({
          id: 123456789,
          username: 'testuser',
        }),
      })
    );
  });

  it('should send error message to user', async () => {
    const error = new Error('Test error');

    await errorHandler(error, mockCtx);

    expect(mockCtx.reply).toHaveBeenCalled();
    expect(mockCtx.reply.mock.calls[0][0]).toContain('❌');
  });

  it('should handle errors without user context', async () => {
    const error = new Error('Test error');
    const ctxWithoutUser = {
      update: {},
      reply: jest.fn().mockResolvedValue({}),
    };

    await expect(errorHandler(error, ctxWithoutUser)).resolves.not.toThrow();
  });

  it('should handle errors when reply fails', async () => {
    const error = new Error('Test error');
    mockCtx.reply.mockRejectedValue(new Error('Reply failed'));

    await expect(errorHandler(error, mockCtx)).resolves.not.toThrow();
  });
});
