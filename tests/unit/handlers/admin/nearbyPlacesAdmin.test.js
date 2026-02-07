// Undo the manual __mocks__/telegraf.js so the real Markup is available
jest.unmock('telegraf');

jest.mock('../../../../src/bot/services/nearbyPlaceService');
jest.mock('../../../../src/models/nearbyPlaceCategoryModel');
jest.mock('../../../../src/models/nearbyPlaceModel');
jest.mock('../../../../src/bot/services/permissionService');

const NearbyPlaceService = require('../../../../src/bot/services/nearbyPlaceService');
const NearbyPlaceCategoryModel = require('../../../../src/models/nearbyPlaceCategoryModel');
const NearbyPlaceModel = require('../../../../src/models/nearbyPlaceModel');
const PermissionService = require('../../../../src/bot/services/permissionService');
const registerNearbyPlacesAdminHandlers = require('../../../../src/bot/handlers/admin/nearbyPlacesAdmin');

// ── helpers ──

const MOCK_CATEGORIES = [
  { id: 1, slug: 'wellness' },
  { id: 2, slug: 'cruising' },
  { id: 3, slug: 'adult_entertainment' },
  { id: 4, slug: 'pnp_friendly' },
  { id: 5, slug: 'help_centers' },
  { id: 6, slug: 'saunas' },
  { id: 7, slug: 'bars_clubs' },
  { id: 8, slug: 'community_business' },
];

function buildCsv(rows) {
  const headers = [
    'name', 'place_type', 'category_slug', 'address', 'city', 'country',
    'lat', 'lng', 'description', 'phone', 'email', 'website',
    'telegram_username', 'instagram', 'price_range', 'is_community_owned',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const vals = headers.map(h => {
      const v = row[h] ?? '';
      return `"${v}"`;
    });
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

/**
 * Collects handlers registered on bot.action / bot.on during setup.
 * Returns a lookup object keyed by action name or "on:<event>".
 */
function collectHandlers() {
  const handlers = {};
  const bot = {
    action: (nameOrRegex, handler) => {
      const key = nameOrRegex instanceof RegExp ? nameOrRegex.toString() : nameOrRegex;
      handlers[key] = handler;
    },
    on: (event, handler) => {
      // Store all on-handlers in an array since there may be multiple per event
      const key = `on:${event}`;
      if (!handlers[key]) handlers[key] = [];
      handlers[key].push(handler);
    },
  };
  registerNearbyPlacesAdminHandlers(bot);
  return handlers;
}

function makeCtx(overrides = {}) {
  const session = overrides.session || { temp: {} };
  return {
    from: { id: 123456 },
    chat: { type: 'private' },
    message: overrides.message || {},
    telegram: {
      getFileLink: jest.fn().mockResolvedValue({ href: 'https://file.tg/test.csv' }),
      sendMessage: jest.fn().mockResolvedValue({}),
      ...overrides.telegram,
    },
    session,
    saveSession: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue({ message_id: 1 }),
    replyWithDocument: jest.fn().mockResolvedValue({ message_id: 2 }),
    editMessageText: jest.fn().mockResolvedValue(true),
    answerCbQuery: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ── tests ──

describe('Nearby Places Admin – Bulk Upload', () => {
  let handlers;

  beforeAll(() => {
    handlers = collectHandlers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    PermissionService.isAdmin.mockResolvedValue(true);
    NearbyPlaceCategoryModel.getAll.mockResolvedValue(MOCK_CATEGORIES);
    NearbyPlaceModel.create.mockResolvedValue({ id: 99 });
  });

  // ── admin panel includes Bulk Upload button ──

  describe('admin_nearby_places panel', () => {
    it('should include the Bulk Upload button', async () => {
      NearbyPlaceService.getStats.mockResolvedValue({ places: {}, submissions: {} });
      NearbyPlaceService.countPending.mockResolvedValue(0);
      const ctx = makeCtx();
      await handlers['admin_nearby_places'](ctx);
      expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
      const opts = ctx.editMessageText.mock.calls[0][1];
      const json = JSON.stringify(opts);
      expect(json).toContain('admin_bulk_upload_places');
      expect(json).toContain('Bulk Upload');
    });
  });

  // ── bulk upload instructions panel ──

  describe('admin_bulk_upload_places', () => {
    it('should show instructions with template and upload buttons', async () => {
      const ctx = makeCtx();
      await handlers['admin_bulk_upload_places'](ctx);
      expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
      const text = ctx.editMessageText.mock.calls[0][0];
      expect(text).toContain('Bulk Upload Places');
      expect(text).toContain('category_slug');
      const opts = ctx.editMessageText.mock.calls[0][1];
      const json = JSON.stringify(opts);
      expect(json).toContain('admin_bulk_template');
      expect(json).toContain('admin_bulk_upload_start');
      expect(json).toContain('admin_nearby_places');
    });

    it('should block non-admins', async () => {
      PermissionService.isAdmin.mockResolvedValue(false);
      const ctx = makeCtx();
      await handlers['admin_bulk_upload_places'](ctx);
      expect(ctx.editMessageText).not.toHaveBeenCalled();
    });
  });

  // ── template download ──

  describe('admin_bulk_template', () => {
    it('should send a CSV document with headers and example rows', async () => {
      const ctx = makeCtx();
      await handlers['admin_bulk_template'](ctx);
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(ctx.replyWithDocument).toHaveBeenCalledTimes(1);

      const docArg = ctx.replyWithDocument.mock.calls[0][0];
      expect(docArg.filename).toBe('nearby_places_template.csv');
      expect(Buffer.isBuffer(docArg.source)).toBe(true);

      const csv = docArg.source.toString();
      expect(csv).toContain('name,place_type,category_slug');
      expect(csv).toContain('Rainbow Wellness Spa');
      expect(csv).toContain('Sunset Park Lookout');
    });

    it('should block non-admins', async () => {
      PermissionService.isAdmin.mockResolvedValue(false);
      const ctx = makeCtx();
      await handlers['admin_bulk_template'](ctx);
      expect(ctx.replyWithDocument).not.toHaveBeenCalled();
    });
  });

  // ── upload start ──

  describe('admin_bulk_upload_start', () => {
    it('should set session flag and prompt for file', async () => {
      const ctx = makeCtx();
      await handlers['admin_bulk_upload_start'](ctx);
      expect(ctx.session.temp.awaitingBulkUpload).toBe(true);
      expect(ctx.saveSession).toHaveBeenCalled();
      expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
      const text = ctx.editMessageText.mock.calls[0][0];
      expect(text).toContain('Send me the CSV file now');
    });
  });

  // ── upload cancel ──

  describe('admin_bulk_upload_cancel', () => {
    it('should clear session flag', async () => {
      const ctx = makeCtx({ session: { temp: { awaitingBulkUpload: true } } });
      await handlers['admin_bulk_upload_cancel'](ctx);
      expect(ctx.session.temp.awaitingBulkUpload).toBeUndefined();
      expect(ctx.saveSession).toHaveBeenCalled();
      expect(ctx.editMessageText).toHaveBeenCalled();
    });
  });

  // ── document handler ──

  describe('document handler', () => {
    let documentHandlers;

    beforeAll(() => {
      // There are two on:document handlers (the custom rejection text is on:text),
      // the bulk upload document handler is the last registered on('document', ...)
      documentHandlers = handlers['on:document'];
    });

    function getDocHandler() {
      // The bulk upload handler is the only document handler
      return documentHandlers[documentHandlers.length - 1];
    }

    it('should pass through if awaitingBulkUpload is not set', async () => {
      const next = jest.fn();
      const ctx = makeCtx({ session: { temp: {} } });
      await getDocHandler()(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('should pass through for group chats', async () => {
      const next = jest.fn();
      const ctx = makeCtx({
        chat: { type: 'group' },
        session: { temp: { awaitingBulkUpload: true } },
      });
      await getDocHandler()(ctx, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject non-CSV files', async () => {
      const next = jest.fn();
      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: {
          document: { file_name: 'data.xlsx', file_size: 500, file_id: 'f1' },
        },
      });
      await getDocHandler()(ctx, next);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('CSV file'));
    });

    it('should reject files larger than 1 MB', async () => {
      const next = jest.fn();
      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: {
          document: { file_name: 'data.csv', file_size: 2 * 1024 * 1024, file_id: 'f1' },
        },
      });
      await getDocHandler()(ctx, next);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('too large'));
    });

    it('should clear session flag and pass through if not admin', async () => {
      PermissionService.isAdmin.mockResolvedValue(false);
      const next = jest.fn();
      const session = { temp: { awaitingBulkUpload: true } };
      const ctx = makeCtx({ session });
      await getDocHandler()(ctx, next);
      expect(session.temp.awaitingBulkUpload).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    // ── successful upload ──

    it('should create places from valid CSV rows', async () => {
      const csv = buildCsv([
        { name: 'Place A', place_type: 'business', category_slug: 'wellness', city: 'Madrid', lat: '40.4', lng: '-3.7' },
        { name: 'Place B', place_type: 'place_of_interest', category_slug: 'cruising' },
      ]);

      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const next = jest.fn();
      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: {
          document: { file_name: 'places.csv', file_size: csv.length, file_id: 'f1' },
        },
      });

      await getDocHandler()(ctx, next);

      expect(NearbyPlaceCategoryModel.getAll).toHaveBeenCalledWith(false);
      expect(NearbyPlaceModel.create).toHaveBeenCalledTimes(2);

      // First call – Place A with location
      const call1 = NearbyPlaceModel.create.mock.calls[0][0];
      expect(call1.name).toBe('Place A');
      expect(call1.placeType).toBe('business');
      expect(call1.categoryId).toBe(1); // wellness = id 1
      expect(call1.location).toEqual({ lat: 40.4, lng: -3.7 });
      expect(call1.status).toBe('approved');

      // Second call – Place B without location
      const call2 = NearbyPlaceModel.create.mock.calls[1][0];
      expect(call2.name).toBe('Place B');
      expect(call2.placeType).toBe('place_of_interest');
      expect(call2.categoryId).toBe(2); // cruising = id 2
      expect(call2.location).toBeNull();

      // Summary message
      const summaryCall = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summaryCall).toBeTruthy();
      expect(summaryCall[0]).toContain('2/2');

      // Session cleared
      expect(ctx.session.temp.awaitingBulkUpload).toBeUndefined();
    });

    // ── validation errors ──

    it('should report rows with missing required name', async () => {
      const csv = buildCsv([
        { name: '', place_type: 'business', category_slug: 'wellness' },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 100, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(NearbyPlaceModel.create).not.toHaveBeenCalled();
      const summary = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summary[0]).toContain('0/1');
      expect(summary[0]).toContain('missing name');
    });

    it('should report rows with invalid place_type', async () => {
      const csv = buildCsv([
        { name: 'X', place_type: 'invalid_type', category_slug: 'wellness' },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 100, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(NearbyPlaceModel.create).not.toHaveBeenCalled();
      const summary = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summary[0]).toContain('invalid place_type');
    });

    it('should report rows with invalid category_slug', async () => {
      const csv = buildCsv([
        { name: 'X', place_type: 'business', category_slug: 'nonexistent' },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 100, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(NearbyPlaceModel.create).not.toHaveBeenCalled();
      const summary = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summary[0]).toContain('invalid category_slug');
    });

    it('should report rows with out-of-range lat/lng', async () => {
      const csv = buildCsv([
        { name: 'X', place_type: 'business', category_slug: 'wellness', lat: '999', lng: '0' },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 100, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(NearbyPlaceModel.create).not.toHaveBeenCalled();
      const summary = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summary[0]).toContain('invalid lat');
    });

    it('should report rows with non-numeric lat', async () => {
      const csv = buildCsv([
        { name: 'X', place_type: 'business', category_slug: 'wellness', lat: 'abc', lng: '2' },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 100, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(NearbyPlaceModel.create).not.toHaveBeenCalled();
      const summary = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summary[0]).toContain('invalid lat');
    });

    // ── mixed valid + invalid rows ──

    it('should create valid rows and report errors for invalid ones', async () => {
      const csv = buildCsv([
        { name: 'Good Place', place_type: 'business', category_slug: 'saunas' },
        { name: '', place_type: 'business', category_slug: 'saunas' },
        { name: 'Also Good', place_type: 'place_of_interest', category_slug: 'bars_clubs' },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 500, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(NearbyPlaceModel.create).toHaveBeenCalledTimes(2);
      const summary = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summary[0]).toContain('2/3');
      expect(summary[0]).toContain('Row 3');
    });

    // ── NearbyPlaceModel.create failure ──

    it('should catch create errors and report per-row failures', async () => {
      NearbyPlaceModel.create
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('DB constraint'));

      const csv = buildCsv([
        { name: 'OK', place_type: 'business', category_slug: 'wellness' },
        { name: 'Fail', place_type: 'business', category_slug: 'wellness' },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 500, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      const summary = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summary[0]).toContain('1/2');
      expect(summary[0]).toContain('DB constraint');
    });

    // ── empty CSV ──

    it('should report empty CSV when no data rows', async () => {
      const csv = 'name,place_type,category_slug\n';
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 50, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('empty'));
    });

    // ── malformed CSV ──

    it('should report CSV parse errors', async () => {
      // Unbalanced quotes will cause csv-parse to throw
      const badCsv = 'name,place_type\n"unclosed quote,business';
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(badCsv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 50, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('parse error'));
    });

    // ── is_community_owned parsing ──

    it('should parse is_community_owned true/false correctly', async () => {
      const csv = buildCsv([
        { name: 'Comm', place_type: 'business', category_slug: 'community_business', is_community_owned: 'true' },
        { name: 'Priv', place_type: 'business', category_slug: 'community_business', is_community_owned: 'false' },
        { name: 'Yes', place_type: 'business', category_slug: 'community_business', is_community_owned: 'yes' },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 500, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(NearbyPlaceModel.create).toHaveBeenCalledTimes(3);
      expect(NearbyPlaceModel.create.mock.calls[0][0].isCommunityOwned).toBe(true);
      expect(NearbyPlaceModel.create.mock.calls[1][0].isCommunityOwned).toBe(false);
      expect(NearbyPlaceModel.create.mock.calls[2][0].isCommunityOwned).toBe(true);
    });

    // ── optional fields mapped correctly ──

    it('should pass optional fields through to NearbyPlaceModel.create', async () => {
      const csv = buildCsv([{
        name: 'Full Place',
        place_type: 'business',
        category_slug: 'wellness',
        address: '123 St',
        city: 'Berlin',
        country: 'Germany',
        lat: '52.52',
        lng: '13.405',
        description: 'Nice spot',
        phone: '+491234',
        email: 'a@b.com',
        website: 'https://example.com',
        telegram_username: 'mybot',
        instagram: 'myinsta',
        price_range: '$$$',
        is_community_owned: 'true',
      }]);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 1000, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      expect(NearbyPlaceModel.create).toHaveBeenCalledTimes(1);
      const data = NearbyPlaceModel.create.mock.calls[0][0];
      expect(data).toMatchObject({
        name: 'Full Place',
        placeType: 'business',
        categoryId: 1,
        address: '123 St',
        city: 'Berlin',
        country: 'Germany',
        location: { lat: 52.52, lng: 13.405 },
        description: 'Nice spot',
        phone: '+491234',
        email: 'a@b.com',
        website: 'https://example.com',
        telegramUsername: 'mybot',
        instagram: 'myinsta',
        priceRange: '$$$',
        isCommunityOwned: true,
        status: 'approved',
      });
    });

    // ── error truncation for many errors ──

    it('should truncate errors when more than 20 rows fail', async () => {
      const rows = [];
      for (let i = 0; i < 25; i++) {
        rows.push({ name: '', place_type: 'business', category_slug: 'wellness' });
      }
      const csv = buildCsv(rows);
      global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(csv) });

      const ctx = makeCtx({
        session: { temp: { awaitingBulkUpload: true } },
        message: { document: { file_name: 'p.csv', file_size: 5000, file_id: 'f1' } },
      });
      await getDocHandler()(ctx, jest.fn());

      const summary = ctx.reply.mock.calls.find(c => c[0].includes('Bulk Upload Complete'));
      expect(summary[0]).toContain('0/25');
      expect(summary[0]).toContain('...and 5 more errors');
    });
  });
});
