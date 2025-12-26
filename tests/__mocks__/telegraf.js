// Mock for Telegraf
class TelegrafMock {
  constructor(token) {
    this.token = token;
    this.middleware = [];
    this.handlers = new Map();
    this.errorHandler = null;

    this.telegram = {
      setWebhook: jest.fn().mockResolvedValue(true),
      deleteWebhook: jest.fn().mockResolvedValue(true),
      sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
      editMessageText: jest.fn().mockResolvedValue(true),
      deleteMessage: jest.fn().mockResolvedValue(true),
      answerCallbackQuery: jest.fn().mockResolvedValue(true),
    };
  }

  use(fn) {
    this.middleware.push(fn);
    return this;
  }

  command(cmd, handler) {
    this.handlers.set(`command:${cmd}`, handler);
    return this;
  }

  action(action, handler) {
    this.handlers.set(`action:${action}`, handler);
    return this;
  }

  on(event, handler) {
    this.handlers.set(`on:${event}`, handler);
    return this;
  }

  hears(trigger, handler) {
    this.handlers.set(`hears:${trigger}`, handler);
    return this;
  }

  catch(handler) {
    this.errorHandler = handler;
    return this;
  }

  launch() {
    return Promise.resolve();
  }

  stop(signal) {
    return Promise.resolve();
  }

  webhookCallback(path) {
    return (req, res) => {
      res.status(200).send('OK');
    };
  }

  // Helper for tests
  __simulateUpdate(update) {
    return this.handleUpdate(update);
  }

  async handleUpdate(update) {
    const ctx = this.__createContext(update);

    for (const mw of this.middleware) {
      await mw(ctx, () => Promise.resolve());
    }

    return ctx;
  }

  __createContext(update) {
    return {
      update,
      telegram: this.telegram,
      from: update.message?.from || update.callback_query?.from,
      message: update.message,
      callbackQuery: update.callback_query,
      reply: jest.fn().mockResolvedValue({ message_id: 1 }),
      replyWithMarkdown: jest.fn().mockResolvedValue({ message_id: 1 }),
      editMessageText: jest.fn().mockResolvedValue(true),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      session: {},
      state: {},
    };
  }
}

module.exports = { Telegraf: TelegrafMock };
